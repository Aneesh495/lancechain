// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;



contract FreelanceDAO {
    struct Project {
        uint256 id;
        address client;
        address freelancer;
        uint256 amount;
        bool isCompleted;
        bool isDisputed;
    }

    mapping(uint256 => Project) public projects;
    uint256 public nextProjectId;

    mapping(address => uint256) public reputation;

    function createProject(address freelancer) public payable {
        require(msg.value > 0, "Project must have funding");
        projects[nextProjectId] = Project({
            id: nextProjectId,
            client: msg.sender,
            freelancer: freelancer,
            amount: msg.value,
            isCompleted: false,
            isDisputed: false
        });
        nextProjectId++;
    }


    function markAsCompleted(uint256 projectId) public {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only the freelancer can mark as complete");
        require(!project.isCompleted, "Project already completed");
        project.isCompleted = true;
    }

    function confirmCompletion(uint256 projectId) public {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only the client can confirm completion");
        require(project.isCompleted, "Project not marked as completed");
        payable(project.freelancer).transfer(project.amount);
    }

    function raiseDispute(uint256 projectId) public {
        Project storage project = projects[projectId];
        require(msg.sender == project.client || msg.sender == project.freelancer, "Only client or freelancer can raise dispute");
        require(!project.isCompleted, "Cannot dispute a completed project");
        project.isDisputed = true;
    }

    function resolveDispute(uint256 projectId, bool voteForFreelancer) public {
        Project storage project = projects[projectId];
        require(project.isDisputed, "No dispute for this project");

        if (voteForFreelancer) {
            payable(project.freelancer).transfer(project.amount);
        } else {
            payable(project.client).transfer(project.amount);
        }

        project.isDisputed = false;
    }
}
