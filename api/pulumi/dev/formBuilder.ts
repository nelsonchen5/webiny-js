import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import policies from "./policies";

export type EsDomain = aws.elasticsearch.Domain | pulumi.Output<aws.elasticsearch.GetDomainResult>;

interface FormBuilderParams {
    env: Record<string, string>;
    dynamoDbTable: aws.dynamodb.Table;
    elasticSearchDomain: EsDomain;
}

class FormBuilder {
    role: aws.iam.Role;
    functions: {
        installation: aws.lambda.Function;
    };

    constructor({ env, dynamoDbTable, elasticSearchDomain }: FormBuilderParams) {
        this.role = new aws.iam.Role("fb-installation-lambda-role", {
            assumeRolePolicy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Principal: {
                            Service: "lambda.amazonaws.com"
                        },
                        Effect: "Allow"
                    }
                ]
            }
        });

        const policy = policies.getFbInstallationLambdaPolicy({
            elasticSearchDomain,
            dynamoDbTable
        });

        new aws.iam.RolePolicyAttachment(`fb-installation-lambda-role-policy-attachment`, {
            role: this.role,
            policyArn: policy.arn.apply(arn => arn)
        });

        new aws.iam.RolePolicyAttachment(`fb-installation-lambda-AWSLambdaBasicExecutionRole`, {
            role: this.role,
            policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole
        });

        const installation = new aws.lambda.Function("fb-installation", {
            role: this.role.arn,
            runtime: "nodejs12.x",
            handler: "handler.handler",
            timeout: 10,
            memorySize: 128,
            description: "Installs the Form Builder application.",
            code: new pulumi.asset.AssetArchive({
                ".": new pulumi.asset.FileArchive("../code/formBuilder/installation/build")
            }),
            environment: {
                variables: {
                    ...env
                }
            }
        });

        this.functions = {
            installation
        };
    }
}

export default FormBuilder;
