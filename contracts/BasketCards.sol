// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

/// @title BasketCards
/// @notice Tribe Trading Cards as a standard, transferable ERC-721. The token id is Tribe's card id. Tribe mints each
/// card and records its tier here; a tier only moves up. The picture and numbers come from tokenURI, so a card keeps
/// following the basket or copy it was earned on, whoever holds it.
contract BasketCards {
    string public constant name = "Tribe Trading Cards";
    string public constant symbol = "TTC";
    uint8 public constant TOP_TIER = 2; // 0 base, 1 glitter, 2 holo

    address public owner;
    string public baseURI;
    mapping(uint256 => uint8) public tierOf;

    mapping(uint256 => address) private holders;
    mapping(address => uint256) private balances;
    mapping(uint256 => address) private tokenApprovals;
    mapping(address => mapping(address => bool)) private operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed holder, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed holder, address indexed operator, bool approved);
    event MetadataUpdate(uint256 tokenId); // ERC-4906: marketplaces refresh the card
    event BatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId);

    error NotOwner();
    error NotAuthorized();
    error NoSuchCard();
    error AlreadyMinted();
    error ZeroAddress();
    error WrongHolder();
    error BadTier();
    error UnsafeRecipient();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(string memory baseURI_) {
        owner = msg.sender;
        baseURI = baseURI_;
    }

    function mint(address to, uint256 tokenId, uint8 tier) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (holders[tokenId] != address(0)) revert AlreadyMinted();
        if (tier > TOP_TIER) revert BadTier();
        holders[tokenId] = to;
        balances[to] += 1;
        tierOf[tokenId] = tier;
        emit Transfer(address(0), to, tokenId);
    }

    function setTier(uint256 tokenId, uint8 tier) external onlyOwner {
        if (holders[tokenId] == address(0)) revert NoSuchCard();
        if (tier > TOP_TIER || tier <= tierOf[tokenId]) revert BadTier();
        tierOf[tokenId] = tier;
        emit MetadataUpdate(tokenId);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseURI = baseURI_;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return holders[tokenId] != address(0);
    }

    function ownerOf(uint256 tokenId) public view returns (address holder) {
        holder = holders[tokenId];
        if (holder == address(0)) revert NoSuchCard();
    }

    function balanceOf(address holder) external view returns (uint256) {
        if (holder == address(0)) revert ZeroAddress();
        return balances[holder];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return string.concat(baseURI, toString(tokenId), ".json");
    }

    function approve(address to, uint256 tokenId) external {
        address holder = ownerOf(tokenId);
        if (msg.sender != holder && !operatorApprovals[holder][msg.sender]) revert NotAuthorized();
        tokenApprovals[tokenId] = to;
        emit Approval(holder, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address holder, address operator) external view returns (bool) {
        return operatorApprovals[holder][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address holder = ownerOf(tokenId);
        if (holder != from) revert WrongHolder();
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != holder && msg.sender != tokenApprovals[tokenId] && !operatorApprovals[holder][msg.sender]) revert NotAuthorized();
        delete tokenApprovals[tokenId];
        balances[from] -= 1;
        balances[to] += 1;
        holders[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 reply) {
                if (reply != IERC721Receiver.onERC721Received.selector) revert UnsafeRecipient();
            } catch {
                revert UnsafeRecipient();
            }
        }
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd || id == 0x5b5e139f || id == 0x49064906; // ERC-165, 721, 721 metadata, 4906
    }

    function toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        for (uint256 v = value; v != 0; v /= 10) digits++;
        bytes memory out = new bytes(digits);
        for (; value != 0; value /= 10) out[--digits] = bytes1(uint8(48 + (value % 10)));
        return string(out);
    }
}
