// Static regression for a shared production-data finance RPC. No credentials or writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../migrations/",import.meta.url);
const sql=readFileSync(new URL("20261025_payment_amount_integrity.sql",base),"utf8");
const rollback=readFileSync(new URL("20261025_payment_amount_integrity.rollback.sql",base),"utf8");
const verify=readFileSync(new URL("20261025_payment_amount_integrity.verify.sql",base),"utf8");
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.academy_update_payment/);
assert.match(sql,/academy_role_allowed\(array\['owner','manager','finance'\]\)/);
assert.match(sql,/academy_enrollments[\s\S]*?FOR UPDATE/);
assert.match(sql,/academy_payments[\s\S]*?FOR UPDATE/);
assert.match(sql,/academy_payment_allocations/);
assert.match(sql,/v_allocated\s*>\s*0\s+OR\s+r\.installment_id IS NOT NULL/);
assert.match(sql,/p_amount\s*>\s*r\.amount\s+AND\s+p_amount\s*>\s*greatest\(v_final_fee-v_other_paid,0\)/);
assert.match(sql,/status='posted'/);
assert.doesNotMatch(sql,/\b(?:DELETE|TRUNCATE|DROP TABLE)\b/i);
assert.match(rollback,/CREATE OR REPLACE FUNCTION public\.academy_update_payment/);
assert.match(verify,/overpaid_enrollments/);
console.log("PASS: payment UPDATE preserves allocations and prevents increased overpayment");
