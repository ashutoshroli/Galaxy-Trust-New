// Shared helpers for recording which cashier(s) handled a transaction.
// Allocations are polymorphic: (ref_type, ref_id) point to a contribution,
// expense or staff_payment row. direction is 'in' (collected) or 'out' (disbursed).

// Clean an incoming cashiers payload: [{ member_id, amount }] -> validated list.
export function normalizeCashiers(cashiers) {
  if (!Array.isArray(cashiers)) return [];
  const seen = new Set();
  const out = [];
  for (const c of cashiers) {
    const memberId = parseInt(c?.member_id, 10);
    const amount = parseFloat(c?.amount);
    if (!memberId || seen.has(memberId)) continue;
    if (isNaN(amount) || amount <= 0) continue;
    seen.add(memberId);
    out.push({ member_id: memberId, amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

// Delete every allocation linked to a transaction.
export async function deleteAllocations(db, refType, refId) {
  await db.query('DELETE FROM cashier_allocations WHERE ref_type = $1 AND ref_id = $2', [refType, refId]);
}

// Replace all allocations for a transaction with the given list.
// `db` may be a pool or a transaction client.
export async function replaceAllocations(db, refType, refId, direction, cashiers) {
  const list = normalizeCashiers(cashiers);
  await deleteAllocations(db, refType, refId);
  for (const c of list) {
    await db.query(
      `INSERT INTO cashier_allocations (ref_type, ref_id, cashier_member_id, amount, direction)
       VALUES ($1, $2, $3, $4, $5)`,
      [refType, refId, c.member_id, c.amount, direction]
    );
  }
  return list;
}

// Fetch allocations for a set of transaction ids, returning a map of
// ref_id -> [{ member_id, name, amount }] for attaching to API responses.
export async function getAllocationsMap(db, refType, refIds) {
  if (!Array.isArray(refIds) || refIds.length === 0) return {};
  const result = await db.query(
    `SELECT ca.ref_id, ca.cashier_member_id AS member_id, m.name, ca.amount
     FROM cashier_allocations ca
     JOIN members m ON m.id = ca.cashier_member_id
     WHERE ca.ref_type = $1 AND ca.ref_id = ANY($2::int[])
     ORDER BY m.name`,
    [refType, refIds]
  );
  const map = {};
  for (const row of result.rows) {
    if (!map[row.ref_id]) map[row.ref_id] = [];
    map[row.ref_id].push({ member_id: row.member_id, name: row.name, amount: parseFloat(row.amount) });
  }
  return map;
}
