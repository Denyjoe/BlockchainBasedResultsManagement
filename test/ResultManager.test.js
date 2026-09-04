import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;
import { canonicalizeResultData, computeResultHash } from "../frontend/src/utils/hashUtils.js";

describe("ResultManager Smart Contract & Canonical Verification", function () {
  let ResultManager;
  let resultManager;
  let owner;
  let lecturer;
  let student;
  let anotherLecturer;

  beforeEach(async function () {
    [owner, lecturer, student, anotherLecturer] = await ethers.getSigners();

    ResultManager = await ethers.getContractFactory("ResultManager");
    resultManager = await ResultManager.deploy(owner.address);
    await resultManager.waitForDeployment();

    // Whitelist one lecturer
    await resultManager.addLecturer(lecturer.address);
  });

  describe("Access Control", function () {
    it("Should allow the owner to add a lecturer", async function () {
      await expect(resultManager.addLecturer(anotherLecturer.address))
        .to.emit(resultManager, "LecturerAdded")
        .withArgs(anotherLecturer.address);
      expect(await resultManager.lecturers(anotherLecturer.address)).to.be.true;
    });

    it("Should allow the owner to remove a lecturer", async function () {
      await resultManager.addLecturer(anotherLecturer.address);
      await expect(resultManager.removeLecturer(anotherLecturer.address))
        .to.emit(resultManager, "LecturerRemoved")
        .withArgs(anotherLecturer.address);
      expect(await resultManager.lecturers(anotherLecturer.address)).to.be.false;
    });

    it("Should prevent non-owners from managing lecturers", async function () {
      await expect(
        resultManager.connect(lecturer).addLecturer(anotherLecturer.address)
      ).to.be.reverted;
    });

    it("Should prevent non-whitelisted addresses from uploading results", async function () {
      const resultHash = ethers.keccak256(ethers.toUtf8Bytes("test-hash-data"));
      await expect(
        resultManager.connect(student).uploadResult("STU100", resultHash)
      ).to.be.revertedWith("Caller is not an authorized lecturer");
    });
  });

  describe("Canonical Hash Utility & Round-Trip Determinism", function () {
    const studentSample = {
      regNumber: "REG-2026-0001",
      name: "John Doe",
      academicYear: "2026/2027 Semester 1",
      department: "Computer Science",
      subjects: [
        { subject: "Data Structures", marks: 88 },
        { subject: "Algorithms", marks: 92 },
        { subject: "Database Systems", marks: 85 }
      ]
    };

    it("Should produce identical hash regardless of subject order, extra spaces, or case", function () {
      const hash1 = computeResultHash(
        studentSample.regNumber,
        studentSample.name,
        studentSample.academicYear,
        studentSample.department,
        studentSample.subjects
      );

      // Permute subject order, add leading/trailing spaces, mix lowercase/uppercase, string numbers
      const scrambledSubjects = [
        { subject: "  database systems  ", marks: "85" },
        { subject: "DATA STRUCTURES", marks: 88 },
        { subject: "algorithms ", marks: "92.0" }
      ];

      const hash2 = computeResultHash(
        " reg-2026-0001 ",
        "  JOHN DOE  ",
        " 2026/2027 semester 1 ",
        " computer science ",
        scrambledSubjects
      );

      expect(hash1).to.equal(hash2);
    });

    it("Should produce a different hash when any mark is altered (tampering)", function () {
      const originalHash = computeResultHash(
        studentSample.regNumber,
        studentSample.name,
        studentSample.academicYear,
        studentSample.department,
        studentSample.subjects
      );

      const tamperedSubjects = [
        { subject: "Data Structures", marks: 99 }, // 88 -> 99
        { subject: "Algorithms", marks: 92 },
        { subject: "Database Systems", marks: 85 }
      ];

      const tamperedHash = computeResultHash(
        studentSample.regNumber,
        studentSample.name,
        studentSample.academicYear,
        studentSample.department,
        tamperedSubjects
      );

      expect(tamperedHash).to.not.equal(originalHash);
    });

    it("Should produce a different hash when student name or metadata is altered", function () {
      const originalHash = computeResultHash(
        studentSample.regNumber,
        studentSample.name,
        studentSample.academicYear,
        studentSample.department,
        studentSample.subjects
      );

      const tamperedNameHash = computeResultHash(
        studentSample.regNumber,
        "Jane Doe", // Changed name
        studentSample.academicYear,
        studentSample.department,
        studentSample.subjects
      );

      expect(tamperedNameHash).to.not.equal(originalHash);
    });
  });

  describe("End-to-End On-Chain Verification Workflow", function () {
    const regNumber = "REG-2026-8888";
    const name = "Alice Wonderland";
    const academicYear = "2025/2026 Semester 2";
    const department = "Software Engineering";
    const subjects = [
      { subject: "Web Development", marks: 90 },
      { subject: "Cryptography", marks: 95 }
    ];

    let registeredHash;

    beforeEach(async function () {
      // 1. Lecturer computes canonical hash at upload time
      registeredHash = computeResultHash(regNumber, name, academicYear, department, subjects);

      // 2. Lecturer publishes hash to the smart contract
      await resultManager.connect(lecturer).uploadResult(regNumber, registeredHash);
    });

    it("Should return true when verifying an unmodified document round-trip", async function () {
      // 3. Document is parsed back (simulated extraction with potential whitespace/ordering differences)
      const parsedFromDoc = {
        regNumber: "  REG-2026-8888  ",
        name: "ALICE WONDERLAND",
        academicYear: "2025/2026 SEMESTER 2",
        department: "SOFTWARE ENGINEERING",
        subjects: [
          { subject: "CRYPTOGRAPHY", marks: 95 },
          { subject: "WEB DEVELOPMENT", marks: 90 }
        ]
      };

      // 4. Verify handler computes hash from parsed data
      const verifyHash = computeResultHash(
        parsedFromDoc.regNumber,
        parsedFromDoc.name,
        parsedFromDoc.academicYear,
        parsedFromDoc.department,
        parsedFromDoc.subjects
      );

      // Must be byte-for-byte equal to registered hash
      expect(verifyHash).to.equal(registeredHash);

      // 5. Contract verification call returns true
      const isValid = await resultManager.verifyIntegrity(regNumber, verifyHash);
      expect(isValid).to.be.true;
    });

    it("Should return false when verifying a document with altered marks (tamper detection)", async function () {
      // Tampered document with Cryptography mark modified from 95 to 100
      const tamperedDoc = {
        regNumber: regNumber,
        name: name,
        academicYear: academicYear,
        department: department,
        subjects: [
          { subject: "Web Development", marks: 90 },
          { subject: "Cryptography", marks: 100 } // Altered mark!
        ]
      };

      const tamperedHash = computeResultHash(
        tamperedDoc.regNumber,
        tamperedDoc.name,
        tamperedDoc.academicYear,
        tamperedDoc.department,
        tamperedDoc.subjects
      );

      expect(tamperedHash).to.not.equal(registeredHash);

      // Contract integrity verification MUST return false
      const isValid = await resultManager.verifyIntegrity(regNumber, tamperedHash);
      expect(isValid).to.be.false;
    });

    it("Should return false for unregistered student registration numbers", async function () {
      const fakeHash = computeResultHash("REG-FAKE-0000", name, academicYear, department, subjects);
      const isValid = await resultManager.verifyIntegrity("REG-FAKE-0000", fakeHash);
      expect(isValid).to.be.false;
    });
  });
});
