// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PharmaChain
 * @notice Blockchain-based pharmaceutical supply chain tracking and medicine
 *         verification system for Mumbai University BLC mini-project.
 * @dev    All primary records are stored on-chain. Off-chain UI is read-only.
 *
 * ROLE HIERARCHY
 * ──────────────
 *  ADMIN  →  authorises Manufacturers, Distributors, Pharmacies
 *  MANUFACTURER  →  registers batches, transfers to DISTRIBUTOR
 *  DISTRIBUTOR   →  receives from MANUFACTURER, transfers to PHARMACY
 *  PHARMACY      →  receives from DISTRIBUTOR, marks as dispensed
 *
 * SUPPLY-CHAIN STATE MACHINE
 * ──────────────────────────
 *  REGISTERED → IN_TRANSIT(M→D) → AT_DISTRIBUTOR → IN_TRANSIT(D→P) → AT_PHARMACY → DISPENSED
 */
contract PharmaChain {

    // ═══════════════════════════════════════════════════════════════
    //  ENUMS
    // ═══════════════════════════════════════════════════════════════

    enum Role { NONE, ADMIN, MANUFACTURER, DISTRIBUTOR, PHARMACY }

    enum BatchStatus {
        REGISTERED,       // 0 – just registered by manufacturer
        IN_TRANSIT_TO_D,  // 1 – in transit manufacturer → distributor
        AT_DISTRIBUTOR,   // 2 – received by distributor
        IN_TRANSIT_TO_P,  // 3 – in transit distributor → pharmacy
        AT_PHARMACY,      // 4 – received by pharmacy
        DISPENSED         // 5 – dispensed to patient / sold
    }

    // ═══════════════════════════════════════════════════════════════
    //  STRUCTS
    // ═══════════════════════════════════════════════════════════════

    struct Medicine {
        string  batchId;           // unique batch identifier
        string  name;              // medicine name
        string  manufacturerName;  // human-readable manufacturer name
        address manufacturerAddr;  // wallet that registered the batch
        uint256 manufacturingDate; // unix timestamp
        uint256 expiryDate;        // unix timestamp
        address currentOwner;      // current custodian wallet
        uint256 registeredAt;      // block.timestamp at registration
        BatchStatus status;
        bool    exists;            // sentinel for "has been registered"
    }

    struct HistoryEntry {
        address from;
        address to;
        BatchStatus action;        // status AFTER this event
        uint256 timestamp;
        string  note;              // optional human-readable note
    }

    struct Participant {
        address wallet;
        Role    role;
        string  name;
        bool    authorized;
    }

    // ═══════════════════════════════════════════════════════════════
    //  STORAGE
    // ═══════════════════════════════════════════════════════════════

    address public admin;

    // batchId → Medicine
    mapping(string => Medicine) private medicines;

    // batchId → supply-chain history
    mapping(string => HistoryEntry[]) private history;

    // wallet → Participant
    mapping(address => Participant) private participants;

    // Indexed list of all batch IDs (for dashboard / getAllBatchIds)
    string[] private allBatchIds;

    // Indexed list of all participant addresses
    address[] private allParticipants;

    // Pending transfers: batchId → intended next owner
    mapping(string => address) private pendingTransfer;

    // ═══════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════

    event ParticipantAuthorized(
        address indexed wallet,
        Role    role,
        string  name,
        uint256 timestamp
    );

    event ParticipantRevoked(
        address indexed wallet,
        uint256 timestamp
    );

    event MedicineRegistered(
        string  indexed batchId,
        string  name,
        address indexed manufacturer,
        uint256 expiryDate,
        uint256 timestamp
    );

    event MedicineTransferred(
        string  indexed batchId,
        address indexed from,
        address indexed to,
        BatchStatus     newStatus,
        uint256         timestamp
    );

    event MedicineReceived(
        string  indexed batchId,
        address indexed receiver,
        BatchStatus     newStatus,
        uint256         timestamp
    );

    event MedicineDispensed(
        string  indexed batchId,
        address indexed pharmacy,
        uint256         timestamp
    );

    // ═══════════════════════════════════════════════════════════════
    //  CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════

    error NotAdmin();
    error NotAuthorized(address caller, Role required);
    error BatchAlreadyExists(string batchId);
    error BatchNotFound(string batchId);
    error InvalidDates();
    error BatchExpired(string batchId);
    error NotCurrentOwner(address caller, address owner);
    error NoPendingTransfer(string batchId);
    error NotIntendedRecipient(address caller, address intended);
    error InvalidTransition(BatchStatus current, BatchStatus target);
    error RecipientNotAuthorized(address recipient);
    error EmptyString(string field);

    // ═══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRole(Role role) {
        if (participants[msg.sender].role != role || !participants[msg.sender].authorized) {
            revert NotAuthorized(msg.sender, role);
        }
        _;
    }

    modifier batchExists(string memory batchId) {
        if (!medicines[batchId].exists) revert BatchNotFound(batchId);
        _;
    }

    modifier notExpired(string memory batchId) {
        if (block.timestamp > medicines[batchId].expiryDate) revert BatchExpired(batchId);
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() {
        admin = msg.sender;
        // Register the deployer as ADMIN participant for UI convenience
        participants[msg.sender] = Participant({
            wallet:     msg.sender,
            role:       Role.ADMIN,
            name:       "Admin",
            authorized: true
        });
        allParticipants.push(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ROLE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Authorize a participant with a specific role.
     * @dev    Only ADMIN can call. Re-authorizing an existing participant
     *         updates their role and name.
     */
    function authorizeParticipant(
        address wallet,
        Role    role,
        string  calldata name
    ) external onlyAdmin {
        if (wallet == address(0)) revert NotAuthorized(wallet, role);
        if (role == Role.NONE || role == Role.ADMIN) revert NotAuthorized(wallet, role);
        if (bytes(name).length == 0) revert EmptyString("name");

        bool isNew = participants[wallet].wallet == address(0);
        participants[wallet] = Participant({
            wallet:     wallet,
            role:       role,
            name:       name,
            authorized: true
        });
        if (isNew) allParticipants.push(wallet);

        emit ParticipantAuthorized(wallet, role, name, block.timestamp);
    }

    /**
     * @notice Revoke a participant's authorization.
     */
    function revokeParticipant(address wallet) external onlyAdmin {
        participants[wallet].authorized = false;
        emit ParticipantRevoked(wallet, block.timestamp);
    }

    /**
     * @notice Return details for a specific participant.
     */
    function getParticipant(address wallet)
        external
        view
        returns (Participant memory)
    {
        return participants[wallet];
    }

    /**
     * @notice Return all registered participant addresses.
     */
    function getAllParticipants() external view returns (address[] memory) {
        return allParticipants;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MEDICINE REGISTRATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Register a new medicine batch. Only authorized MANUFACTURER.
     * @param batchId         Unique batch identifier (e.g. "BATCH-001")
     * @param name            Medicine name
     * @param manufacturerName Human-readable manufacturer name
     * @param manufacturingDate Unix timestamp of manufacturing date
     * @param expiryDate        Unix timestamp of expiry date
     */
    function registerMedicine(
        string calldata batchId,
        string calldata name,
        string calldata manufacturerName,
        uint256 manufacturingDate,
        uint256 expiryDate
    ) external onlyRole(Role.MANUFACTURER) {
        // Validations
        if (bytes(batchId).length == 0)          revert EmptyString("batchId");
        if (bytes(name).length == 0)             revert EmptyString("name");
        if (bytes(manufacturerName).length == 0) revert EmptyString("manufacturerName");
        if (medicines[batchId].exists)           revert BatchAlreadyExists(batchId);
        if (expiryDate <= manufacturingDate)     revert InvalidDates();
        if (expiryDate <= block.timestamp)       revert BatchExpired(batchId);

        medicines[batchId] = Medicine({
            batchId:          batchId,
            name:             name,
            manufacturerName: manufacturerName,
            manufacturerAddr: msg.sender,
            manufacturingDate: manufacturingDate,
            expiryDate:       expiryDate,
            currentOwner:     msg.sender,
            registeredAt:     block.timestamp,
            status:           BatchStatus.REGISTERED,
            exists:           true
        });

        history[batchId].push(HistoryEntry({
            from:      address(0),
            to:        msg.sender,
            action:    BatchStatus.REGISTERED,
            timestamp: block.timestamp,
            note:      "Batch registered by manufacturer"
        }));

        allBatchIds.push(batchId);

        emit MedicineRegistered(batchId, name, msg.sender, expiryDate, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  TRANSFER (initiates a pending transfer)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Initiate transfer of a batch to an authorized next custodian.
     *
     * Allowed transitions:
     *   MANUFACTURER (REGISTERED)     → DISTRIBUTOR  (IN_TRANSIT_TO_D)
     *   DISTRIBUTOR  (AT_DISTRIBUTOR) → PHARMACY     (IN_TRANSIT_TO_P)
     */
    function transferMedicine(
        string  calldata batchId,
        address to
    )
        external
        batchExists(batchId)
        notExpired(batchId)
    {
        Medicine storage med = medicines[batchId];

        // Only current owner can transfer
        if (msg.sender != med.currentOwner) revert NotCurrentOwner(msg.sender, med.currentOwner);

        Participant storage sender = participants[msg.sender];
        Participant storage recipient = participants[to];

        // Recipient must be authorized
        if (!recipient.authorized) revert RecipientNotAuthorized(to);

        BatchStatus newStatus;

        if (sender.role == Role.MANUFACTURER && med.status == BatchStatus.REGISTERED) {
            if (recipient.role != Role.DISTRIBUTOR) revert RecipientNotAuthorized(to);
            newStatus = BatchStatus.IN_TRANSIT_TO_D;
        } else if (sender.role == Role.DISTRIBUTOR && med.status == BatchStatus.AT_DISTRIBUTOR) {
            if (recipient.role != Role.PHARMACY) revert RecipientNotAuthorized(to);
            newStatus = BatchStatus.IN_TRANSIT_TO_P;
        } else {
            revert InvalidTransition(med.status, newStatus);
        }

        med.status = newStatus;
        pendingTransfer[batchId] = to;

        history[batchId].push(HistoryEntry({
            from:      msg.sender,
            to:        to,
            action:    newStatus,
            timestamp: block.timestamp,
            note:      "Transfer initiated"
        }));

        emit MedicineTransferred(batchId, msg.sender, to, newStatus, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  RECEIVE (recipient acknowledges receipt)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Acknowledge receipt of a pending batch transfer.
     *
     * Allowed transitions:
     *   IN_TRANSIT_TO_D → AT_DISTRIBUTOR  (called by DISTRIBUTOR)
     *   IN_TRANSIT_TO_P → AT_PHARMACY     (called by PHARMACY)
     */
    function receiveMedicine(string calldata batchId)
        external
        batchExists(batchId)
        notExpired(batchId)
    {
        Medicine storage med = medicines[batchId];
        address intended = pendingTransfer[batchId];

        if (intended == address(0)) revert NoPendingTransfer(batchId);
        if (msg.sender != intended) revert NotIntendedRecipient(msg.sender, intended);

        BatchStatus newStatus;

        if (med.status == BatchStatus.IN_TRANSIT_TO_D) {
            if (participants[msg.sender].role != Role.DISTRIBUTOR)
                revert NotAuthorized(msg.sender, Role.DISTRIBUTOR);
            newStatus = BatchStatus.AT_DISTRIBUTOR;
        } else if (med.status == BatchStatus.IN_TRANSIT_TO_P) {
            if (participants[msg.sender].role != Role.PHARMACY)
                revert NotAuthorized(msg.sender, Role.PHARMACY);
            newStatus = BatchStatus.AT_PHARMACY;
        } else {
            revert InvalidTransition(med.status, newStatus);
        }

        address previousOwner = med.currentOwner;
        med.status = newStatus;
        med.currentOwner = msg.sender;
        delete pendingTransfer[batchId];

        history[batchId].push(HistoryEntry({
            from:      previousOwner,
            to:        msg.sender,
            action:    newStatus,
            timestamp: block.timestamp,
            note:      "Receipt acknowledged"
        }));

        emit MedicineReceived(batchId, msg.sender, newStatus, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  DISPENSE  (pharmacy marks as dispensed)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mark a batch as dispensed. Only the pharmacy holding it.
     */
    function dispenseMedicine(string calldata batchId)
        external
        batchExists(batchId)
        onlyRole(Role.PHARMACY)
    {
        Medicine storage med = medicines[batchId];
        if (msg.sender != med.currentOwner) revert NotCurrentOwner(msg.sender, med.currentOwner);
        if (med.status != BatchStatus.AT_PHARMACY) revert InvalidTransition(med.status, BatchStatus.DISPENSED);

        med.status = BatchStatus.DISPENSED;

        history[batchId].push(HistoryEntry({
            from:      msg.sender,
            to:        address(0),
            action:    BatchStatus.DISPENSED,
            timestamp: block.timestamp,
            note:      "Medicine dispensed to patient"
        }));

        emit MedicineDispensed(batchId, msg.sender, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  QUERY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Return all registered batch IDs.
     */
    function getAllBatchIds() external view returns (string[] memory) {
        return allBatchIds;
    }

    /**
     * @notice Return medicine details for a specific batch.
     */
    function getMedicine(string calldata batchId)
        external
        view
        batchExists(batchId)
        returns (Medicine memory)
    {
        return medicines[batchId];
    }

    /**
     * @notice Return the supply-chain history entries for a batch.
     */
    function getMedicineHistory(string calldata batchId)
        external
        view
        batchExists(batchId)
        returns (HistoryEntry[] memory)
    {
        return history[batchId];
    }

    /**
     * @notice Verify a medicine batch.
     * @return exists_       Whether the batch is registered.
     * @return isExpired_    Whether the batch is past its expiry date.
     * @return status_       Current supply-chain status.
     * @return currentOwner_ Current custodian address.
     * @return expiryDate_   Expiry unix timestamp.
     * @return name_         Medicine name.
     */
    function verifyMedicine(string calldata batchId)
        external
        view
        returns (
            bool   exists_,
            bool   isExpired_,
            BatchStatus status_,
            address currentOwner_,
            uint256 expiryDate_,
            string  memory name_
        )
    {
        Medicine storage med = medicines[batchId];
        exists_       = med.exists;
        isExpired_    = med.exists && (block.timestamp > med.expiryDate);
        status_       = med.status;
        currentOwner_ = med.currentOwner;
        expiryDate_   = med.expiryDate;
        name_         = med.name;
    }

    /**
     * @notice Return the pending transfer recipient for a batch (address(0) if none).
     */
    function getPendingTransfer(string calldata batchId)
        external
        view
        returns (address)
    {
        return pendingTransfer[batchId];
    }

    /**
     * @notice Convenience: return role of a wallet address.
     */
    function getRole(address wallet) external view returns (Role) {
        if (!participants[wallet].authorized) return Role.NONE;
        return participants[wallet].role;
    }

    /**
     * @notice Return the admin address.
     */
    function getAdmin() external view returns (address) {
        return admin;
    }
}
