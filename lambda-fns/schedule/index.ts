import {SQSEvent} from "aws-lambda";

import {
    CreateScheduleCommand,
    CreateScheduleCommandInput,
    DeleteScheduleCommand,
    FlexibleTimeWindowMode,
    SchedulerClient,
    UpdateScheduleCommand,
    UpdateScheduleCommandInput
} from "@aws-sdk/client-scheduler";

interface TodoEvent {
    id: string
    owner?: string
    title?: string
    done?: boolean
    phone?: string
    duedate?: string
}

interface TodoNotification {
    id: string
    phone: string
    title: string
}

const scheduler = new SchedulerClient({
    region: process.env.AWS_REGION,
});
export async function schedule(event: SQSEvent): Promise<any> {

    console.debug(`Incoming records count: ${event.Records.length}`)

    for (const record of event.Records) {
        console.debug(`record body: ${record.body}`)
        const body = JSON.parse(record.body)
        const subject = body.Subject
        const event = JSON.parse(body.Message) as TodoEvent
        console.debug(`Subject: ${subject}`)
        console.debug(`event: ${body.Message}`)
        if (subject === "CREATE") {
            if (!event.duedate || !event.phone) {
                return
            }
            console.debug(`Creating schedule`)
            const createCommand = createScheduleCommand(event)
            await scheduler.send(createCommand)
        } else if (subject === "DELETE" || (subject === "UPDATE" && event.done)) {
            await scheduler.send(new DeleteScheduleCommand({
                Name: event.id,
                GroupName: process.env.SCHEDULER_GROUP_NAME
            }))
        } else if (subject === "UPDATE") {
            if (!event.duedate || !event.phone) {
                return
            }
            console.debug(`Updating schedule`)
            const updateCommand = updateScheduleCommand(event)
            await scheduler.send(updateCommand)
        } else {
            throw Error("Unknown operation type!")
        }
    }
}

const createScheduleCommand = (todoEvent: TodoEvent): CreateScheduleCommand => {
    return new CreateScheduleCommand(eventToSaveCommandProps(todoEvent))
};

const eventToSaveCommandProps = (todoEvent: TodoEvent): CreateScheduleCommandInput | UpdateScheduleCommandInput => {
    const notificationEvent: TodoNotification = {
        id: todoEvent.id,
        phone: todoEvent.phone!,
        title: todoEvent.title!
    }
    return {
        Name: todoEvent.id,
        FlexibleTimeWindow: {
            Mode: FlexibleTimeWindowMode.OFF
        },
        GroupName: process.env.SCHEDULER_GROUP_NAME,
        ScheduleExpression: `at(${todoEvent.duedate})`,
        ScheduleExpressionTimezone: "Europe/Prague",
        Target: {
            Arn: process.env.SCHEDULER_TARGET_ARN,
            RoleArn: process.env.SCHEDULER_ROLE_ARN,
            Input: JSON.stringify(notificationEvent)
        }
    }
}

const updateScheduleCommand = (todoEvent: TodoEvent): UpdateScheduleCommand => {
    return new UpdateScheduleCommand(eventToSaveCommandProps(todoEvent))
};