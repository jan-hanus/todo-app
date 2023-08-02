#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {DynamodbCrudStack} from '../lib/dynamodb-crud-stack';

const app = new cdk.App();
const dynamoCrudStackJH = new DynamodbCrudStack(app, 'DynamodbCrudStackMVP', { owner: "MVP"});
