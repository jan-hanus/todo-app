import {SQSEvent} from "aws-lambda";
import {PublishCommand, PublishInput, SNSClient} from "@aws-sdk/client-sns";
import {DeleteScheduleCommand, SchedulerClient} from "@aws-sdk/client-scheduler";

interface TodoNotification {
    id: string
    phone: string
    title: string
}

const snsClient = new SNSClient({
    region: 'us-east-1'
})

const scheduler = new SchedulerClient({
    region: process.env.AWS_REGION,
});

export async function notify(event: SQSEvent): Promise<any> {

    console.debug(`Incoming records count: ${event.Records.length}`)

    for (const record of event.Records) {
        console.debug(`record body: ${record.body}`)
        const event = JSON.parse(record.body) as TodoNotification

        try {
            await snsClient.send(new PublishCommand({
                PhoneNumber: event.phone,
                Message: `Ahoj, nezapomnel(a) jsi na sve TODO: '${event.title}'? Prave vyprsel termin vyrizeni.`
            } as PublishInput))


        } catch (err) {

            console.log(err)

            throw err;
        }

        try {
            await scheduler.send(new DeleteScheduleCommand({
                Name: event.id,
                GroupName: process.env.SCHEDULER_GROUP_NAME
            }))
        } catch (err) {
            console.error(`Failed to delete schedule: ${event.id}`)
        }
    }
}