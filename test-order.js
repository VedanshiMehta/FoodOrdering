const { Client, Databases } = require('node-appwrite');
const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('6784d1f2001eb70f64be');
const db = new Databases(client);

async function main() {
    const orders = await db.listDocuments('6784d293003058863ddc', '6784d6b60037a5beeb65');
    console.log(JSON.stringify(orders.documents[0], null, 2));
}
main();
