// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract ReputationTracker {
    struct Freelancer {
        uint256 reputationScore; //freelancer's rep score.
        uint256 completedProjects; //number of projects freenlancer has succesfully completed.
        uint256 totalRatings; //number of ratings freelancer has received.
    }

    mapping(address => Freelancer) public freelancers;

    event ReputationUpdated(address indexed freelancer, uint256 newScore); 

    // update individual's reputation after a project is completed
    function updateReputation(address _freelancer, uint256 _rating) external {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5"); 
        //individual's rating has to be between 1-5 "stars
        
        Freelancer storage freelancer = freelancers[_freelancer];

        freelancer.completedProjects++; //increment's freelancer's completedProjects by one.
        freelancer.totalRatings += _rating; //increases freelancer's total number of ratings appropriately.
        freelancer.reputationScore = freelancer.totalRatings / freelancer.completedProjects; 
        //finds freelancer's average rating by dividing total rartings by total number of projects completed.

        emit ReputationUpdated(_freelancer, freelancer.reputationScore);
    }

    // Get reputation of a freelancer
    function getReputation(address _freelancer) external view returns (uint256) {
        return freelancers[_freelancer].reputationScore; //return's freenlancer's reputation score.
    }
}
