import {CfnOutput, Fn, IResolvable, RemovalPolicy, Stack, StackProps} from "aws-cdk-lib"
import {Construct} from "constructs"
import {AttributeType, BillingMode, Table} from 'aws-cdk-lib/aws-dynamodb';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import {Architecture, CfnFunction, Runtime, Tracing} from 'aws-cdk-lib/aws-lambda';
import {Asset} from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";
import {ApiDefinition, InlineApiDefinition, MethodLoggingLevel, SpecRestApi} from "aws-cdk-lib/aws-apigateway";
import {apiStageName} from "./variables";
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";

export class DynamodbCrudStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const todoTable = new Table(this, 'todoTable', {
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

    const createTodoFn = new NodejsFunction(this, 'createTodoFn', {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/create/index.ts`,
      handler: 'createTodo',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName
      }
    })

    const createCfn = createTodoFn.node.defaultChild as CfnFunction;
    createCfn.overrideLogicalId("CreateLambda")

    todoTable.grantReadWriteData(createTodoFn)

    const getAllTodoFn = new NodejsFunction(this, 'getAllTodoFn', {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/getAll/index.ts`,
      handler: 'getAll',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName
      }
    })
    const getAllCfn = getAllTodoFn.node.defaultChild as CfnFunction;
    getAllCfn.overrideLogicalId("GetAllLambda")

    todoTable.grantReadData(getAllTodoFn)

    const getOneTodoFn = new NodejsFunction(this, 'getOneTodoFn', {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/getOne/index.ts`,
      handler: 'getOne',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName
      }
    })

    const getOneCfn = getOneTodoFn.node.defaultChild as CfnFunction;
    getOneCfn.overrideLogicalId("GetOneLambda")

    todoTable.grantReadData(getOneTodoFn)

    const updateTodoFn = new NodejsFunction(this, 'updateTodoFn', {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/update/index.ts`,
      handler: 'update',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName
      }
    })

    const updateCfn = updateTodoFn.node.defaultChild as CfnFunction;
    updateCfn.overrideLogicalId("UpdateLambda")

    todoTable.grantReadWriteData(updateTodoFn)

    const deleteTodoFn = new NodejsFunction(this, 'deleteTodoFn', {
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambda-fns/delete/index.ts`,
      handler: 'deleteTodo',
      tracing: Tracing.ACTIVE,
      architecture: Architecture.X86_64,
      environment: {
        TODO_TABLE_NAME: todoTable.tableName
      }
    })

    const deleteCfn = deleteTodoFn.node.defaultChild as CfnFunction;
    deleteCfn.overrideLogicalId("DeleteLambda")

    todoTable.grantReadWriteData(deleteTodoFn)

    const tableWithIndex = Table.fromTableAttributes(this, 'tableWithIndex', {
      tableName: todoTable.tableName,
      globalIndexes: ['ownerIndex']
    })

    const openApiAsset = new Asset(this, "todo-open-api", {
      path: path.join(__dirname, './api-definition.yml')
    })

    const transformMap = {
      "Location": openApiAsset.s3ObjectUrl
    }

    const data: IResolvable = Fn.transform("AWS::Include", transformMap)

    const apiDefinition: InlineApiDefinition = ApiDefinition.fromInline(data)

    const specRestApi = new SpecRestApi(this, 'todo-api', {
      apiDefinition: apiDefinition,
      restApiName: "todo-api",
      deployOptions: {
        stageName: apiStageName,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true
      },
      deploy: true
    })


    createTodoFn.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    })
    updateTodoFn.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    })
    deleteTodoFn.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    })
    getOneTodoFn.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    })
    getAllTodoFn.addPermission('PermitAPIGInvocation', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: specRestApi.arnForExecuteApi('*')
    })

  }
}