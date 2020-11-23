/* eslint-disable @typescript-eslint/no-use-before-define */
import { gzipSync } from 'zlib';
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
		const debug =
			userInfo &&
			(userInfo.userName === 'daedin' || userInfo.userId === 'OW_7fca23da-49df-4254-8ae7-fbee31e22373');
		if (debug) {
			console.log('debug mode', userInfo);
		}
		// console.log('input', JSON.stringify(event));
		let selectClause = '';
		if (userInfo) {
			console.log('retrieving from userInfo', userInfo);
			// Hacky, but that's the only place where we have all three to make the links
			const uniqueIdentifiers = await mysql.query(
				`
					SELECT DISTINCT userName, userId 
					FROM achievement_stat
					WHERE userName = '${userInfo.userName || '__invalid__'}' 
						OR userId = '${userInfo.userId || '__invalid__'}' 
				`,
			);
			const userNamesCondition = [
				...uniqueIdentifiers.filter(id => id.userName).map(id => "'" + id.userName + "'"),
				`'${userInfo.userName}'`,
			].join(',');
			const userIdCondition = [
				...uniqueIdentifiers.filter(id => id.userId).map(id => "'" + id.userId + "'"),
				`'${userInfo.userId}'`,
			].join(',');
			const finalNameCondition = isEmpty(userNamesCondition) ? `'__invalid__'` : userNamesCondition;
			const finalIdCondition = isEmpty(userIdCondition) ? `'__invalid__'` : userIdCondition;
			selectClause = `
				WHERE userId in (${finalNameCondition}, ${finalIdCondition})
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

		let expectedEmpty = false;
		if (results.length === 0) {
			const testQuery = `SELECT reviewId FROM replay_summary WHERE userId = '${userInfo.userId}' LIMIT 1`;
			const testResult = await mysql.query(testQuery);
			expectedEmpty = !testResult || testResult.length === 0;
			if (debug) {
				console.log('empty result, is expected?', expectedEmpty);
			}
		}
		console.log('results', results && results.length);
		await mysql.end();
		const result = Object.assign(new GlobalStats(), {
			stats: results,
		} as GlobalStats);

		const stringResults = JSON.stringify({ result, expectedEmpty: expectedEmpty });
		const gzippedResults = gzipSync(stringResults).toString('base64');
		console.log('compressed', stringResults.length, gzippedResults.length);
		const response = {
			statusCode: 200,
			isBase64Encoded: true,
			body: gzippedResults,
			headers: {
				'Content-Type': 'text/html',
				'Content-Encoding': 'gzip',
			},
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
