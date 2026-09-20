const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function actorFrom(request, env) {
  const email = request.headers.get('CF-Access-Authenticated-User-Email') || '';
  if (env.ENVIRONMENT === 'development' && !email) return 'local-dev';
  const allowed = (env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!email || !allowed.includes(email.toLowerCase())) return null;
  return email.toLowerCase();
}

function bodyInt(v, name, min = 0) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new Error(`${name} نامعتبر است`);
  return n;
}

async function audit(env, actor, action, entityType, entityId, payload = null) {
  await env.DB.prepare('INSERT INTO audit_log (id,actor,action,entity_type,entity_id,payload_json) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), actor, action, entityType, entityId, payload ? JSON.stringify(payload) : null).run();
}

async function dashboard(env) {
  const [students, active, revenue, receivable, overdue] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) c FROM students"),
    env.DB.prepare("SELECT COUNT(*) c FROM enrollments WHERE status='active'"),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE substr(paid_at,1,7)=substr(date('now'),1,7)"),
    env.DB.prepare("SELECT COALESCE(SUM(e.final_fee),0)-COALESCE((SELECT SUM(p.amount) FROM payments p),0) v FROM enrollments e WHERE e.status IN ('active','completed')"),
    env.DB.prepare("SELECT COUNT(*) c FROM installments WHERE status IN ('pending','partial') AND due_date < date('now')")
  ]);
  return {
    students: students.results[0]?.c || 0,
    activeEnrollments: active.results[0]?.c || 0,
    monthlyRevenue: revenue.results[0]?.v || 0,
    receivable: Math.max(0, receivable.results[0]?.v || 0),
    overdueInstallments: overdue.results[0]?.c || 0
  };
}

async function listStudents(env, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  let sql = `SELECT s.*, COUNT(e.id) enrollment_count,
    COALESCE(SUM(e.final_fee),0) total_fee,
    COALESCE((SELECT SUM(p.amount) FROM payments p JOIN enrollments ee ON ee.id=p.enrollment_id WHERE ee.student_id=s.id),0) paid_total
    FROM students s LEFT JOIN enrollments e ON e.student_id=s.id WHERE 1=1`;
  const binds = [];
  if (q) { sql += ' AND (s.full_name LIKE ? OR s.mobile LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }
  if (status) { sql += ' AND s.status=?'; binds.push(status); }
  sql += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200';
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return r.results;
}

async function createStudent(request, env, actor) {
  const b = await request.json();
  if (!b.full_name?.trim() || !b.mobile?.trim()) return json({ error: 'نام و موبایل الزامی است' }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO students (id,full_name,mobile,national_id,guardian_name,guardian_mobile,city,birth_date,notes,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,b.full_name.trim(),b.mobile.trim(),b.national_id||null,b.guardian_name||null,b.guardian_mobile||null,b.city||null,b.birth_date||null,b.notes||null,b.status||'lead').run();
  await audit(env, actor, 'student.create', 'student', id, { full_name: b.full_name, mobile: b.mobile });
  return json({ id }, 201);
}

async function createCourse(request, env, actor) {
  const b = await request.json();
  if (!b.title?.trim()) return json({ error: 'عنوان دوره الزامی است' }, 400);
  const id = crypto.randomUUID();
  const fee = bodyInt(b.default_fee ?? 0, 'شهریه');
  await env.DB.prepare('INSERT INTO courses (id,title,code,default_fee) VALUES (?,?,?,?)').bind(id,b.title.trim(),b.code||null,fee).run();
  await audit(env, actor, 'course.create', 'course', id, { title: b.title });
  return json({ id }, 201);
}

async function listCourses(env) {
  return (await env.DB.prepare('SELECT * FROM courses WHERE is_active=1 ORDER BY title').all()).results;
}

async function createEnrollment(request, env, actor) {
  const b = await request.json();
  const gross = bodyInt(b.gross_fee, 'شهریه کل');
  const discount = bodyInt(b.discount ?? 0, 'تخفیف');
  if (discount > gross) return json({ error: 'تخفیف نمی‌تواند بیشتر از شهریه باشد' }, 400);
  const finalFee = gross - discount;
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO enrollments (id,student_id,course_id,cohort,gross_fee,discount,final_fee,status,notes)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(id,b.student_id,b.course_id,b.cohort||null,gross,discount,finalFee,b.status||'active',b.notes||null).run();
  await env.DB.prepare("UPDATE students SET status='active', updated_at=datetime('now') WHERE id=?").bind(b.student_id).run();
  if (Array.isArray(b.installments)) {
    let no = 1;
    for (const item of b.installments) {
      const amount = bodyInt(item.amount, 'مبلغ قسط', 1);
      if (!item.due_date) throw new Error('تاریخ سررسید قسط الزامی است');
      await env.DB.prepare('INSERT INTO installments (id,enrollment_id,installment_no,amount,due_date) VALUES (?,?,?,?,?)')
        .bind(crypto.randomUUID(),id,no++,amount,item.due_date).run();
    }
  }
  await audit(env, actor, 'enrollment.create', 'enrollment', id, { student_id:b.student_id, course_id:b.course_id, final_fee:finalFee });
  return json({ id, final_fee: finalFee }, 201);
}

async function createPayment(request, env, actor) {
  const b = await request.json();
  const amount = bodyInt(b.amount, 'مبلغ پرداخت', 1);
  if (!b.enrollment_id || !b.method || !b.paid_at) return json({ error: 'ثبت‌نام، روش پرداخت و تاریخ الزامی است' }, 400);
  const paymentId = crypto.randomUUID();
  const enrollment = await env.DB.prepare('SELECT final_fee FROM enrollments WHERE id=?').bind(b.enrollment_id).first();
  if (!enrollment) return json({ error: 'ثبت‌نام پیدا نشد' }, 404);
  const paid = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) v FROM payments WHERE enrollment_id=?').bind(b.enrollment_id).first();
  if ((paid?.v || 0) + amount > enrollment.final_fee) return json({ error: 'مبلغ پرداخت از مانده شهریه بیشتر است' }, 409);

  const statements = [env.DB.prepare(`INSERT INTO payments (id,enrollment_id,installment_id,amount,method,reference_no,paid_at,received_by,notes)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(paymentId,b.enrollment_id,b.installment_id||null,amount,b.method,b.reference_no||null,b.paid_at,actor,b.notes||null)];

  if (b.installment_id) {
    const inst = await env.DB.prepare('SELECT amount,paid_amount FROM installments WHERE id=? AND enrollment_id=?').bind(b.installment_id,b.enrollment_id).first();
    if (!inst) return json({ error: 'قسط معتبر نیست' }, 404);
    if (inst.paid_amount + amount > inst.amount) return json({ error: 'مبلغ از مانده این قسط بیشتر است' }, 409);
    const nextPaid = inst.paid_amount + amount;
    statements.push(env.DB.prepare("UPDATE installments SET paid_amount=?, status=? WHERE id=?").bind(nextPaid,nextPaid===inst.amount?'paid':'partial',b.installment_id));
  }
  await env.DB.batch(statements);
  await audit(env, actor, 'payment.create', 'payment', paymentId, { enrollment_id:b.enrollment_id, amount, method:b.method });
  return json({ id: paymentId }, 201);
}

async function dueInstallments(env) {
  return (await env.DB.prepare(`SELECT i.*, s.full_name, s.mobile, c.title course_title,
    (i.amount-i.paid_amount) remaining
    FROM installments i JOIN enrollments e ON e.id=i.enrollment_id JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id
    WHERE i.status IN ('pending','partial') ORDER BY i.due_date ASC LIMIT 200`).all()).results;
}

async function studentDetail(env, id) {
  const student = await env.DB.prepare('SELECT * FROM students WHERE id=?').bind(id).first();
  if (!student) return null;
  const enrollments = (await env.DB.prepare(`SELECT e.*, c.title course_title,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.enrollment_id=e.id),0) paid_total
    FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? ORDER BY e.registered_at DESC`).bind(id).all()).results;
  for (const e of enrollments) {
    e.installments = (await env.DB.prepare('SELECT * FROM installments WHERE enrollment_id=? ORDER BY installment_no').bind(e.id).all()).results;
    e.payments = (await env.DB.prepare('SELECT * FROM payments WHERE enrollment_id=? ORDER BY paid_at DESC').bind(e.id).all()).results;
    e.remaining = Math.max(0, e.final_fee - e.paid_total);
  }
  return { student, enrollments };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const actor = actorFrom(request, env);
    if (!actor) return json({ error: 'دسترسی غیرمجاز' }, 401);
    try {
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return json(await dashboard(env));
      if (request.method === 'GET' && url.pathname === '/api/students') return json(await listStudents(env,url));
      if (request.method === 'POST' && url.pathname === '/api/students') return createStudent(request,env,actor);
      if (request.method === 'GET' && url.pathname === '/api/courses') return json(await listCourses(env));
      if (request.method === 'POST' && url.pathname === '/api/courses') return createCourse(request,env,actor);
      if (request.method === 'POST' && url.pathname === '/api/enrollments') return createEnrollment(request,env,actor);
      if (request.method === 'POST' && url.pathname === '/api/payments') return createPayment(request,env,actor);
      if (request.method === 'GET' && url.pathname === '/api/installments') return json(await dueInstallments(env));
      const m = url.pathname.match(/^\/api\/students\/([^/]+)$/);
      if (request.method === 'GET' && m) {
        const d = await studentDetail(env,m[1]);
        return d ? json(d) : json({ error:'هنرجو پیدا نشد' },404);
      }
      return json({ error: 'مسیر پیدا نشد' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err?.message || 'خطای داخلی' }, 500);
    }
  }
};
