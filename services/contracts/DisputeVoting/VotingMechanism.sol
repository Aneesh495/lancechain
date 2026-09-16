// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract VotingMechanism {
    struct Proposal {
        string title; 
        string description;
        uint256 endTime;
        uint256 votesFor; 
        uint256 votesAgainst;
        bool executed;
    }

    uint256 public proposalCounter;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, string title, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);

    //creates a new proposal
    function createProposal(
        string memory _title, //title of proposal
        string memory _description, //description of proposal.
        uint256 _endTime
    ) external returns (uint256) {
        require(_endTime > block.timestamp, "End time must be in the future");
        //end time has to be greater than current time.
        proposalCounter++; //increment total number of proposals by one. 
        proposals[proposalCounter] = Proposal({
            title: _title,
            description: _description,
            endTime: _endTime,
            votesFor: 0,
            votesAgainst: 0,
            executed: false
        });

        emit ProposalCreated(proposalCounter, _title, _endTime);
        return proposalCounter;
    }

    //vote on a proposal
    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp < proposal.endTime, "Voting has ended"); //if someone tries voting after end time has passed.
        require(!hasVoted[_proposalId][msg.sender], "You have already voted"); //if someone tries voting twice.

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) { //if voter supports.
            proposal.votesFor++; //increment votes for by one.
        } else { //if voter does not support.
            proposal.votesAgainst++; //increment votes against by one. 
        }

        emit VoteCast(_proposalId, msg.sender, _support);
    }

    //get a proposal outcome
    function getProposalOutcome(uint256 _proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp >= proposal.endTime, "Voting has not ended");
        //can't get a proposal outcome before voting time has ended.
        return proposal.votesFor > proposal.votesAgainst; //returns who won the vote.
    }
}