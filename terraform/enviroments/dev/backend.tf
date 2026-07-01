terraform {
  backend "s3" {
    bucket         = "brainbox-tf-state-232939969354"
    key            = "dev/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "brainbox-terraform-lock"
    encrypt        = true
  }
}