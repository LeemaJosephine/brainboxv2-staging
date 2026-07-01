resource "aws_ecr_repository" "frontend" {
  name                 = "${var.environment}-brainbox-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.environment}-brainbox-frontend"
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "${var.environment}-brainbox-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.environment}-brainbox-backend"
  }
}