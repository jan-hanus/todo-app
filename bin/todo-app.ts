#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {DynamodbCrudStack} from '../lib/dynamodb-crud-stack';
import {TodoSchedulerStack} from "../lib/scheduler-stack";

const app = new cdk.App();
const dynamoCrudStack = new DynamodbCrudStack(app, 'DynamodbCrudStack');
const schedulerStack = new TodoSchedulerStack(app, 'SchedulerStack', {
    todoTopic: dynamoCrudStack.todoTopic
})