// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ResultManager
 * @dev Manages student result hashes immutably on the Ethereum blockchain, supporting access control,
 * grade hash upload, and integrity verification.
 */
contract ResultManager is Ownable {

    struct Result {
        string regNumber;
        bytes32 resultHash; // keccak256 hash of student details and grades
        address issuedBy;
        uint256 timestamp;
    }

    // Maps a unique key (keccak256 of regNumber) to the Result struct
    mapping(bytes32 => Result) public results;

    // Whitelist of authorized lecturer addresses
    mapping(address => bool) public lecturers;

    // Events
    event LecturerAdded(address indexed lecturer);
    event LecturerRemoved(address indexed lecturer);
    event ResultUploaded(
        string regNumber,
        bytes32 indexed resultHash,
        address indexed issuedBy
    );

    /**
     * @dev Restricts actions to whitelisted lecturers only.
     */
    modifier onlyLecturer() {
        require(lecturers[msg.sender], "Caller is not an authorized lecturer");
        _;
    }

    /**
     * @dev Initializes the contract setting the owner/admin address.
     * @param initialOwner The address of the admin owner.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Whitelists a new lecturer address.
     * @param lecturer The address of the lecturer.
     */
    function addLecturer(address lecturer) external onlyOwner {
        require(lecturer != address(0), "Invalid lecturer address");
        require(!lecturers[lecturer], "Lecturer already authorized");
        lecturers[lecturer] = true;
        emit LecturerAdded(lecturer);
    }

    /**
     * @dev Revokes lecturer permissions for an address.
     * @param lecturer The address of the lecturer to remove.
     */
    function removeLecturer(address lecturer) external onlyOwner {
        require(lecturers[lecturer], "Lecturer not authorized");
        lecturers[lecturer] = false;
        emit LecturerRemoved(lecturer);
    }

    /**
     * @dev Generates the lookup key for a registration number.
     * @param regNumber The student registration number.
     */
    function getLookupKey(string calldata regNumber) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(regNumber));
    }

    /**
     * @dev Uploads a student's result hash. Restricted to authorized lecturers.
     * @param regNumber The unique registration number of the student.
     * @param resultHash The cryptographic hash of the student's results.
     */
    function uploadResult(
        string calldata regNumber,
        bytes32 resultHash
    ) external onlyLecturer {
        bytes32 key = getLookupKey(regNumber);
        
        results[key] = Result({
            regNumber: regNumber,
            resultHash: resultHash,
            issuedBy: msg.sender,
            timestamp: block.timestamp
        });

        emit ResultUploaded(regNumber, resultHash, msg.sender);
    }

    /**
     * @dev Verifies off-chain data integrity against the stored blockchain hash.
     * @param regNumber The student registration number.
     * @param recomputedHash The hash computed from the uploaded document.
     * @return true if the recomputed hash matches the stored hash, false otherwise.
     */
    function verifyIntegrity(
        string calldata regNumber,
        bytes32 recomputedHash
    ) external view returns (bool) {
        bytes32 key = getLookupKey(regNumber);
        return results[key].resultHash == recomputedHash;
    }
}
