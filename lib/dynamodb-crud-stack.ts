import {CfnOutput, Fn, IResolvable, RemovalPolicy, Stack, StackProps} from "aws-cdk-lib"
import {Construct} from "constructs"
import {AttributeType, BillingMode, Table} from 'aws-cdk-lib/aws-dynamodb';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import {Architecture, CfnFunction, Runtime, Tracing} from 'aws-cdk-lib/aws-lambda';
import {Asset} from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";
import {ApiDefinition, InlineApiDefinition, MethodLoggingLevel, SpecRestApi} from "aws-cdk-lib/aws-apigateway";
import {apiStageName} from "./variables";
import {PolicyStatement, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Topic} from "aws-cdk-lib/aws-sns";


interface DynamodbCrudStackProps extends StackProps {
  owner: string
}
export class DynamodbCrudStack extends Stack {

  public readonly todoTopic: Topic
  constructor(scope: Construct, id: string, props: DynamodbCrudStackProps) {
    super(scope, id, props);

    const owner = props.owner

    // The code that defines your stack goes here
    const todoTable = new Table(this, `${owner}-todoTable`, {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    todoTable.addGlobalSecondaryIndex({
      indexName: 'ownerIndex',
      partitionKey: {
        name: 'owner',
        type: AttributeType.STRING
      }
    })

    new CfnOutput(this, 'todoTableName', {
      value: todoTable.tableName
    })

    this.todoTopic = new Topic(this, `${owner}-todo-topic`, {
      topicName: `${owner}-todo-topic`
    })

    const topicPublishPolicy: PolicyStatement = new PolicyStatement({
      actions: ['sns:publish'],
      resources: [this.todoTopic.topicArn]
    })


    const createTodoFn = new NodejsFunction(this, `${owner}-createTodoFn`, {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/create/index.ts`,
      handler: 'createTodo',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName,
        TODO_TOPIC: this.todoTopic.topicArn
      }
    })

    const createCfn = createTodoFn.node.defaultChild as CfnFunction;
    createCfn.overrideLogicalId("CreateLambda")

    todoTable.grantReadWriteData(createTodoFn)
    createTodoFn.addToRolePolicy(topicPublishPolicy)


    const tableWithIndex = Table.fromTableAttributes(this, `${owner}-tableWithIndex`, {
      tableName: todoTable.tableName,
      globalIndexes: ['ownerIndex']
    })

    const openApiAsset = new Asset(this, `${owner}-todo-open-api`, {
      path: path.join(__dirname, './api-definition.yml')
    })

    const transformMap = {
      "Location": openApiAsset.s3ObjectUrl
    }

    const data: IResolvable = Fn.transform("AWS::Include", transformMap)

    const apiDefinition: InlineApiDefinition = ApiDefinition.fromInline(data)

    const specRestApi = new SpecRestApi(this, `${owner}-todo-api`, {
      apiDefinition: apiDefinition,
      restApiName: `${owner}-todo-api`,
      deployOptions: {
        stageName: apiStageName,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true
      },
      deploy: true
    })

    const apiInvokePermission = {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    };
    createTodoFn.addPermission('PermitAPIGInvocation', apiInvokePermission)

  }
}