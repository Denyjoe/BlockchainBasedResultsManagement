import { ethers } from "ethers";

/**
 * Produces a canonical representation of the result record, applying
 * consistent trimming, uppercasing, numeric normalization, and
 * alphabetical subject ordering. Both the upload path and the verify
 * path MUST call this function before hashing — never duplicate this logic.
 *
 * @param {string} regNumber   - Student registration number.
 * @param {string} name        - Student full name.
 * @param {string} academicYear - Academic year / semester string.
 * @param {string} department  - Department or course of study.
 * @param {Array<{subject: string, marks: number|string}>} subjects - Grade rows.
 * @returns {{ reg: string, name: string, year: string, dept: string, subjects: Array<{subject:string,marks:number}> }}
 */
export function canonicalizeResultData(regNumber, name, academicYear, department, subjects) {
  const reg  = regNumber.trim().toUpperCase();
  const nm   = name.trim().toUpperCase();
  const year = academicYear.trim().toUpperCase();
  const dept = department.trim().toUpperCase();

  // Trim, uppercase, and sort subjects alphabetically — marks as integer
  const sortedSubjects = [...subjects]
    .map(s => ({
      subject: s.subject.trim().toUpperCase(),
      marks:   Number(s.marks),            // always integer number, never string
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return { reg, name: nm, year, dept, subjects: sortedSubjects };
}

/**
 * Computes the canonical Keccak256 hash of a student result record.
 * Uses JSON.stringify on the normalized canonical object, then hashes
 * with keccak256 over UTF-8 bytes — this is 100% deterministic and
 * avoids all solidityPacked array-encoding pitfalls.
 *
 * @param {string} regNumber   - Student registration number.
 * @param {string} name        - Student full name.
 * @param {string} academicYear - Academic year / semester string.
 * @param {string} department  - Department or course of study.
 * @param {Array<{subject: string, marks: number|string}>} subjects - Grade rows.
 * @returns {string} The 0x-prefixed Keccak256 hex hash string.
 */
export function computeResultHash(regNumber, name, academicYear, department, subjects) {
  const canonical = canonicalizeResultData(regNumber, name, academicYear, department, subjects);
  // JSON.stringify with explicit key order ensures deterministic output
  const payload = JSON.stringify({
    reg:      canonical.reg,
    name:     canonical.name,
    year:     canonical.year,
    dept:     canonical.dept,
    subjects: canonical.subjects,
  });
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}
