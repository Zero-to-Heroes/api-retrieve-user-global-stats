import db from './db/rds';
import { GlobalStat } from './model/global-stat';
import { GlobalStats } from './model/global-stats';

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	try {
		console.log('input', JSON.stringify(event));
		const userToken = event.pathParameters && event.pathParameters.proxy;
		console.log('getting stats for user', userToken);
		const mysql = await db.getConnection();
		const dbResults = await mysql.query(
			`
			SELECT * FROM global_stats 
			WHERE userId = '${userToken}'
		`,
		);
		const results: readonly GlobalStat[] = dbResults.map(result =>
			Object.assign(new GlobalStat(), {
				...result,
				value: Math.abs(result.value) < 1 ? result.value : Math.round(result.value),
			} as GlobalStat),
		);
		const result = Object.assign(new GlobalStats(), {
			stats: results,
		} as GlobalStats);
		const response = {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify({ result }),
		};
		console.log('sending back success reponse', response);
		return response;
	} catch (e) {
		console.error('issue retrieving stats', e);
		const response = {
			statusCode: 500,
			isBase64Encoded: false,
			body: JSON.stringify({ message: 'not ok', exception: e }),
		};
		console.log('sending back error reponse', response);
		return response;
	}
};
