############################################
# IAM Role for EKS Cluster
############################################

resource "aws_iam_role" "eks_cluster_role" {
  name = "${var.environment}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [{
      Effect = "Allow"

      Principal = {
        Service = "eks.amazonaws.com"
      }

      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

############################################
# IAM Role for Worker Nodes
############################################

resource "aws_iam_role" "node_group_role" {
  name = "${var.environment}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [{
      Effect = "Allow"

      Principal = {
        Service = "ec2.amazonaws.com"
      }

      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "worker_node_policy" {
  role       = aws_iam_role.node_group_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "cni_policy" {
  role       = aws_iam_role.node_group_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "ecr_policy" {
  role       = aws_iam_role.node_group_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

############################################
# Security Group
############################################

resource "aws_security_group" "eks_cluster" {

  name        = "${var.environment}-eks-cluster-sg"
  description = "EKS Cluster Security Group"

  vpc_id = data.aws_subnet.private.vpc_id

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name = "${var.environment}-eks-cluster-sg"
  }
}

############################################
# Get VPC from Subnet
############################################

data "aws_subnet" "private" {
  id = var.private_subnet_ids[0]
}

############################################
# EKS Cluster
############################################

resource "aws_eks_cluster" "main" {

  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster_role.arn

  version = "1.31"

  vpc_config {

    subnet_ids = var.private_subnet_ids

    security_group_ids = [
      aws_security_group.eks_cluster.id
    ]
  }

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy
  ]

  tags = {
    Name = var.cluster_name
  }
}

############################################
# Managed Node Group
############################################

resource "aws_eks_node_group" "main" {

  cluster_name = aws_eks_cluster.main.name

  node_group_name = "${var.environment}-node-group"

  node_role_arn = aws_iam_role.node_group_role.arn

  subnet_ids = var.private_subnet_ids

  instance_types = [
    "t3.medium"
  ]

  scaling_config {

    desired_size = 2
    min_size     = 1
    max_size     = 2

  }

  depends_on = [
    aws_iam_role_policy_attachment.worker_node_policy,
    aws_iam_role_policy_attachment.cni_policy,
    aws_iam_role_policy_attachment.ecr_policy
  ]

  tags = {
    Name = "${var.environment}-node-group"
  }
}