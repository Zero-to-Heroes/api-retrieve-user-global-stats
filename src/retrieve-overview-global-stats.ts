/* eslint-disable @typescript-eslint/no-use-before-define */
import SqlString from 'sqlstring';
import { gzipSync } from 'zlib';
import db from './db/rds';
import { groupByFunction } from './db/util-functions';
import { GlobalStat } from './model/global-stat';
import { GlobalStats } from './model/global-stats';

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	const escape = SqlString.escape;
	const mysql = await db.getConnection();
	const userInfo = JSON.parse(event.body);
	let selectClause = '';
	if (userInfo) {
		// Hacky, but that's the only place where we have all three to make the links
		const uniqueIdentifiers = await mysql.query(
			`
					SELECT DISTINCT userName, userId 
					FROM achievement_stat
					WHERE userName = ${escape(userInfo.userName || '__invalid__')} 
						OR userId = ${escape(userInfo.userId || '__invalid__')}
				`,
		);
		const userNamesCondition = [
			...uniqueIdentifiers.filter(id => id.userName).map(id => "'" + id.userName + "'"),
			`${escape(userInfo.userName)}`,
		].join(',');
		const userIdCondition = [
			...uniqueIdentifiers.filter(id => id.userId).map(id => "'" + id.userId + "'"),
			`${escape(userInfo.userId)}`,
		].join(',');
		const finalNameCondition = isEmpty(userNamesCondition) ? `'__invalid__'` : userNamesCondition;
		const finalIdCondition = isEmpty(userIdCondition) ? `'__invalid__'` : userIdCondition;
		selectClause = `
				WHERE userId in (${finalNameCondition}, ${finalIdCondition})
			`;
	} else {
		const userToken = event.pathParameters && event.pathParameters.proxy;
		selectClause = `WHERE userId = ${escape(userToken)}`;
	}
	const query = `
			SELECT * FROM global_stats 
			${selectClause}
		`;
	const dbResults: readonly InternalResult[] = await mysql.query(query);
	const grouped = groupByFunction((result: InternalResult) => result.statKey + '-' + result.statContext)(dbResults);

	const results: readonly GlobalStat[] = Object.values(grouped).map((stats: readonly InternalResult[]) => {
		const statRadical = stats[0];
		const statName = statRadical.statKey;
		const mergedValue = statName.startsWith('best')
			? Math.max(...stats.map(stat => stat.value))
			: stats.map(stat => stat.value).reduce((a, b) => a + b, 0);
		const finalValue = Math.abs(mergedValue) < 1 ? mergedValue : Math.round(mergedValue);
		return {
			...statRadical,
			value: finalValue,
		};
	});

	let expectedEmpty = false;
	if (results.length === 0) {
		const testQuery = `SELECT reviewId FROM replay_summary WHERE userId = ${escape(userInfo.userId)} LIMIT 1`;
		const testResult = await mysql.query(testQuery);
		expectedEmpty = !testResult || testResult.length === 0;
	}

	await mysql.end();
	const result = Object.assign(new GlobalStats(), {
		stats: results,
	} as GlobalStats);

	const stringResults = JSON.stringify({ result, expectedEmpty: expectedEmpty });
	const gzippedResults = gzipSync(stringResults).toString('base64');
	const response = {
		statusCode: 200,
		isBase64Encoded: true,
		body: gzippedResults,
		headers: {
			'Content-Type': 'text/html',
			'Content-Encoding': 'gzip',
		},
	};
	return response;
};

const isEmpty = (input: string) => !input || input.length === 0;

interface InternalResult {
	id: number;
	userId: string;
	statKey: string;
	statContext: string;
	value: number;
}
