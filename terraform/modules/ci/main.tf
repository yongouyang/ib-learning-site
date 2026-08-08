# CI module (aws-deployment-plan.md §4): GitHub Actions OIDC provider + deploy
# role. Trust is scoped to exactly one repo + one branch — no stored AWS keys
# in GitHub, short-lived OIDC tokens only.

variable "name_prefix" {
  type    = string
  default = "iblearn"
}

variable "github_repo" {
  description = "GitHub repo in owner/name form."
  type        = string
  default     = "yongouyang/ib-learning-site"
}

variable "github_branch" {
  description = "Branch allowed to assume the deploy role."
  type        = string
  default     = "develop"
}

data "aws_caller_identity" "current" {}

# --- GitHub OIDC provider ------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# --- Deploy role ----------------------------------------------------------------

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

# PowerUserAccess covers S3/CloudFront/Lambda/DynamoDB/Logs state + resources
# but excludes IAM/org — IAM for iblearn-* resources is granted inline below.
resource "aws_iam_role_policy_attachment" "power_user" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

data "aws_iam_policy_document" "iblearn_iam" {
  # Terraform manages the feedback Lambda's execution role.
  statement {
    sid = "ManageIblearnRoles"
    actions = [
      "iam:GetRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:UpdateRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*"]
  }

  statement {
    sid       = "PassIblearnRolesToLambda"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com"]
    }
  }

  # Terraform refreshes the OIDC provider on every apply. PowerUserAccess's
  # IAM allowance does NOT include this read (verified the hard way).
  statement {
    sid       = "ReadGithubOidcProvider"
    actions   = ["iam:GetOpenIDConnectProvider"]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"]
  }
}

resource "aws_iam_role_policy" "iblearn_iam" {
  name   = "${var.name_prefix}-iam"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.iblearn_iam.json
}

output "role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN variable in GitHub repo settings."
  value       = aws_iam_role.github_deploy.arn
}
