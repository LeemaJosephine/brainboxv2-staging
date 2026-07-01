variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
}

variable "dynamodb_table" {
  description = "DynamoDB table name"
  type        = string
}