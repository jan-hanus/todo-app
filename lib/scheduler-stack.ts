import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {CfnScheduleGroup} from "aws-cdk-lib/aws-scheduler";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {Topic} from "aws-cdk-lib/aws-sns";
import {SqsSubscription} from "aws-cdk-lib/aws-sns-subscriptions";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import {Policy, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";


interface SchedulerStackProps extends StackProps {
    todoTopic: Topic
}

export class TodoSchedulerStack extends Stack {
    constructor(scope: Construct, id: string, props: SchedulerStackProps) {
        super(scope, id, props)

        const {todoTopic} = props

        const schedulerGroup = new CfnScheduleGroup(this, 'todoSchedules')

        const scheduleTodoPolicy = new PolicyStatement({
            actions: ["scheduler:CreateSchedule", "scheduler:DeleteSchedule", "scheduler:UpdateSchedule"],
            resources: [`*`]
        })

        const scheduleDlq = new Queue(this, 'schedule-todo-dlq', {
            queueName: 'schedule-todo-dlq'
        })
        const scheduleSqs = new Queue(this, 'schedule-todo-queue', {
            queueName: 'schedule-todo-queue',
            deadLetterQueue: {
                queue: scheduleDlq,
                maxReceiveCount: 3
            },

        })

        todoTopic.addSubscription(new SqsSubscription(scheduleSqs))

        const notificationDlq = new Queue(this, 'notification-todo-dlq', {
            queueName: 'notification-todo-dlq'
        })
        const notificationSqs = new Queue(this, 'notification-todo-queue', {
            queueName: 'notification-todo-queue',
            deadLetterQueue: {
                queue: notificationDlq,
                maxReceiveCount: 3
            },
        })

        const schedulerRole = new Role(this, 'schedulerTodoRole', {
            roleName: "scheduler-todo-role",
            assumedBy: new ServicePrincipal("scheduler.amazonaws.com")
        })
        schedulerRole.addToPolicy(new PolicyStatement({
            actions: ['sqs:SendMessage'],
            resources: [notificationSqs.queueArn]
        }))
        const scheduleRolePassPolicy = new PolicyStatement({
            actions: ['iam:PassRole'],
            resources: [schedulerRole.roleArn]
        })

        const scheduleTodoNotification = new NodejsFunction(this, 'scheduleTodoNotificationFn', {
            runtime: Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambda-fns/schedule/index.ts`,
            handler: 'schedule',
            tracing: Tracing.ACTIVE,
            architecture: Architecture.X86_64,
            environment: {
                SCHEDULER_GROUP_NAME: schedulerGroup.name!,
                SCHEDULER_TARGET_ARN: notificationSqs.queueArn,
                SCHEDULER_ROLE_ARN: schedulerRole.roleArn
            }
        })

        scheduleTodoNotification.role?.attachInlinePolicy(new Policy(this, 'scheduleTodoPolicy', {
            statements: [scheduleTodoPolicy, scheduleRolePassPolicy]
        }))

        const scheduleFnEventSource = new SqsEventSource(scheduleSqs)
        scheduleTodoNotification.addEventSource(scheduleFnEventSource)


        const notifyFn = new NodejsFunction(this, 'notifyFn', {
            runtime: Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambda-fns/notify/index.ts`,
            handler: 'notify',
            tracing: Tracing.ACTIVE,
            architecture: Architecture.X86_64
        })

        notifyFn.addToRolePolicy(scheduleTodoPolicy)

        const notifyFnEventSource = new SqsEventSource(notificationSqs)
        notifyFn.addEventSource(notifyFnEventSource)
    }
}