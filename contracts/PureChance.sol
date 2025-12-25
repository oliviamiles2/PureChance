// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract PureChance is ZamaEthereumConfig {
    struct Ticket {
        euint8 firstPick;
        euint8 secondPick;
        bool active;
    }

    struct DrawResult {
        euint8 firstDraw;
        euint8 secondDraw;
        euint32 reward;
        uint256 blockNumber;
    }

    uint256 public constant TICKET_PRICE = 0.001 ether;

    mapping(address => Ticket) private _tickets;
    mapping(address => euint32) private _scores;
    mapping(address => DrawResult) private _lastDraw;

    event TicketPurchased(address indexed player, euint8 firstPick, euint8 secondPick);
    event DrawCompleted(address indexed player, euint8 firstDraw, euint8 secondDraw, euint32 reward);

    function buyTicket(
        externalEuint8 firstPickInput,
        externalEuint8 secondPickInput,
        bytes calldata inputProof
    ) external payable {
        require(msg.value == TICKET_PRICE, "Ticket price is 0.001 ETH");

        euint8 firstPick = _normalizeSingleDigit(FHE.fromExternal(firstPickInput, inputProof));
        euint8 secondPick = _normalizeSingleDigit(FHE.fromExternal(secondPickInput, inputProof));

        _tickets[msg.sender] = Ticket({firstPick: firstPick, secondPick: secondPick, active: true});

        _allowAccessToTicket(_tickets[msg.sender], msg.sender);
        _ensureScoreInitialized(msg.sender);

        emit TicketPurchased(msg.sender, firstPick, secondPick);
    }

    function startDraw() external returns (euint32) {
        Ticket storage ticket = _tickets[msg.sender];
        require(ticket.active, "No active ticket");

        euint8 firstDraw = _randomSingleDigit();
        euint8 secondDraw = _randomSingleDigit();

        euint32 reward = _calculateReward(ticket.firstPick, ticket.secondPick, firstDraw, secondDraw);
        euint32 currentScore = _scores[msg.sender];
        if (!FHE.isInitialized(currentScore)) {
            currentScore = FHE.asEuint32(0);
        }
        _scores[msg.sender] = FHE.add(currentScore, reward);

        DrawResult storage result = _lastDraw[msg.sender];
        result.firstDraw = firstDraw;
        result.secondDraw = secondDraw;
        result.reward = reward;
        result.blockNumber = block.number;

        ticket.active = false;

        _allowAccessToTicket(ticket, msg.sender);
        _allowAccessToDraw(result, msg.sender);
        _allowAccessToScore(msg.sender);

        emit DrawCompleted(msg.sender, firstDraw, secondDraw, reward);
        return reward;
    }

    function getEncryptedScore(address player) external view returns (euint32) {
        return _scores[player];
    }

    function getTicket(address player) external view returns (euint8, euint8, bool) {
        Ticket storage ticket = _tickets[player];
        return (ticket.firstPick, ticket.secondPick, ticket.active);
    }

    function getLastDraw(address player) external view returns (euint8, euint8, euint32, uint256) {
        DrawResult storage result = _lastDraw[player];
        return (result.firstDraw, result.secondDraw, result.reward, result.blockNumber);
    }

    function _allowAccessToTicket(Ticket storage ticket, address player) internal {
        FHE.allowThis(ticket.firstPick);
        FHE.allowThis(ticket.secondPick);
        FHE.allow(ticket.firstPick, player);
        FHE.allow(ticket.secondPick, player);
    }

    function _allowAccessToDraw(DrawResult storage result, address player) internal {
        FHE.allowThis(result.firstDraw);
        FHE.allowThis(result.secondDraw);
        FHE.allow(result.firstDraw, player);
        FHE.allow(result.secondDraw, player);
        FHE.allowThis(result.reward);
        FHE.allow(result.reward, player);
    }

    function _allowAccessToScore(address player) internal {
        FHE.allowThis(_scores[player]);
        FHE.allow(_scores[player], player);
    }

    function _ensureScoreInitialized(address player) internal {
        euint32 existingScore = _scores[player];
        if (!FHE.isInitialized(existingScore)) {
            _scores[player] = FHE.asEuint32(0);
            _allowAccessToScore(player);
        }
    }

    function _normalizeSingleDigit(euint8 value) internal returns (euint8) {
        // Constrain the pick to the 1-9 range while preserving valid inputs
        euint8 bounded = FHE.rem(FHE.sub(value, 1), 9);
        return FHE.add(bounded, 1);
    }

    function _randomSingleDigit() internal returns (euint8) {
        euint8 raw = FHE.randEuint8();
        euint8 bounded = FHE.rem(raw, 9);
        return FHE.add(bounded, 1);
    }

    function _calculateReward(
        euint8 pickA,
        euint8 pickB,
        euint8 drawA,
        euint8 drawB
    ) internal returns (euint32) {
        ebool pickAMatches = FHE.or(FHE.eq(pickA, drawA), FHE.eq(pickA, drawB));
        ebool pickBMatches = FHE.or(FHE.eq(pickB, drawA), FHE.eq(pickB, drawB));

        ebool picksSame = FHE.eq(pickA, pickB);
        ebool drawsSame = FHE.eq(drawA, drawB);

        ebool bothMatchDifferentValues = FHE.and(
            pickAMatches,
            FHE.and(pickBMatches, FHE.not(drawsSame))
        );
        ebool bothMatchSameValue = FHE.and(picksSame, FHE.and(drawsSame, pickAMatches));
        ebool bothMatch = FHE.or(bothMatchDifferentValues, bothMatchSameValue);

        ebool anyMatch = FHE.or(pickAMatches, pickBMatches);

        euint32 rewardForOne = FHE.asEuint32(10);
        euint32 rewardForTwo = FHE.asEuint32(100);
        euint32 zero = FHE.asEuint32(0);

        euint32 partialReward = FHE.select(anyMatch, rewardForOne, zero);
        return FHE.select(bothMatch, rewardForTwo, partialReward);
    }
}
