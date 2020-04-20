/* eslint-disable @typescript-eslint/no-use-before-define */
import db from './db/rds';
import { GlobalStat } from './model/global-stat';
import { GlobalStats } from './model/global-stats';

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	try {
		const mysql = await db.getConnection();
		const userInfo = JSON.parse(event.body);
		const debug = userInfo && userInfo.userName === 'daedin';
		if (debug) {
			console.log('debug mode');
		}
		// console.log('input', JSON.stringify(event));
		let selectClause = '';
		if (userInfo) {
			console.log('retrieving from userInfo', userInfo);
			const uniqueIdentifiers = await mysql.query(
				`
					SELECT DISTINCT userName, userId, userMachineId 
					FROM achievement_stat
					WHERE userName = '${userInfo.userName || '__invalid__'}' 
						OR userId = '${userInfo.userId || '__invalid__'}' 
						OR userMachineId = '${userInfo.machineId || '__invalid__'}'
				`,
			);
			const userNamesCondition = uniqueIdentifiers
				.filter(id => id.userName)
				.map(id => "'" + id.userName + "'")
				.join(',');
			const userIdCondition = uniqueIdentifiers
				.filter(id => id.userId)
				.map(id => "'" + id.userId + "'")
				.join(',');
			const machineIdCondition = uniqueIdentifiers
				.filter(id => id.userMachineId)
				.map(id => "'" + id.userMachineId + "'")
				.join(',');
			if (isEmpty(userNamesCondition) || isEmpty(userIdCondition) || isEmpty(machineIdCondition)) {
				return {
					statusCode: 200,
					isBase64Encoded: false,
					body: JSON.stringify({ results: [] }),
				};
			}
			selectClause = `
				WHERE userId in (${userIdCondition})
			`;
		} else {
			const userToken = event.pathParameters && event.pathParameters.proxy;
			selectClause = `WHERE userId = '${userToken}'`;
			// console.log('getting stats for user', userToken);
		}
		const query = `
			SELECT * FROM global_stats 
			${selectClause}
		`;
		if (debug) {
			console.log('running query', query);
		}
		const dbResults = await mysql.query(query);
		const results: readonly GlobalStat[] = dbResults.map(result =>
			Object.assign(new GlobalStat(), {
				...result,
				value: Math.abs(result.value) < 1 ? result.value : Math.round(result.value),
			} as GlobalStat),
		);
		console.log('results', results && results.length);
		const result = Object.assign(new GlobalStats(), {
			stats: results,
		} as GlobalStats);
		const response = {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify({ result }),
		};
		// console.log('sending back success reponse', response);
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

const isEmpty = (input: string) => !input || input.length === 0;
