#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {DynamodbCrudStack} from '../lib/dynamodb-crud-stack';
import {TodoSchedulerStack} from "../lib/scheduler-stack";

const app = new cdk.App();
const dynamoCrudStackJH = new DynamodbCrudStack(app, 'DynamodbCrudStackJH', { owner: "JH"});
const schedulerStackJH = new TodoSchedulerStack(app, 'SchedulerStackJH', {
    todoTopic: dynamoCrudStackJH.todoTopic,
    owner: "JH"
})
