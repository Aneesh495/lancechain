// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./VotingMechanism.sol";

contract DisputeResolution {
    VotingMechanism public votingContract;

    enum DisputeStatus { Pending, Resolved, Rejected }

    struct Dispute {
        address client; //address of the client requesting the project.
        address freelancer; //address of the freelancer working on the project.
        uint256 amountLocked; //the amount of crypto in play.
        string description; //description of the dispute.
        DisputeStatus status; //status of the dispute.
        uint256 voteId; //voter id.
    }

    uint256 public disputeCounter;
    mapping(uint256 => Dispute) public disputes;

    event DisputeCreated(
        uint256 indexed disputeId,
        address indexed client,
        address indexed freelancer,
        uint256 amountLocked
    ); 
    //dispute parameters^
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus status);

    constructor(address _votingContract) {
        votingContract = VotingMechanism(_votingContract);
    }

    //creates a new dispute.
    function createDispute(
        address _freelancer,
        uint256 _amountLocked,
        string memory _description
    ) external payable {
        require(msg.value == _amountLocked, "Must lock the correct amount");
        //payable amount should be the same as the amount locked to proceed.

        disputeCounter++; //increments the amount of disputes by one.
        uint256 voteId = votingContract.createProposal(
            "Dispute Resolution",
            _description,
            block.timestamp + 3 days // Voting period of 3 days
        );

        disputes[disputeCounter] = Dispute({
            client: msg.sender,
            freelancer: _freelancer,
            amountLocked: _amountLocked,
            description: _description,
            status: DisputeStatus.Pending,
            voteId: voteId
        });

        emit DisputeCreated(disputeCounter, msg.sender, _freelancer, _amountLocked);
    }

    //resolve the dispute based on the voting outcome.
    function resolveDispute(uint256 _disputeId) external {
        Dispute storage dispute = disputes[_disputeId];
        require(dispute.status == DisputeStatus.Pending, "Dispute already resolved");
        //dispute needs to be unresolved.

        bool votePassed = votingContract.getProposalOutcome(dispute.voteId);

        if (votePassed) { //if public votes in favor of the freelancer.
            dispute.status = DisputeStatus.Resolved; //marks the dispute as solved.
            payable(dispute.freelancer).transfer(dispute.amountLocked); //transfers the amount to the freelancer.
        } else { //if public votes in favor of the client.
            dispute.status = DisputeStatus.Rejected; //rejects the dispute.
            payable(dispute.client).transfer(dispute.amountLocked); //transfers the amount back to the client.
        }

        emit DisputeResolved(_disputeId, dispute.status);
    }
}
