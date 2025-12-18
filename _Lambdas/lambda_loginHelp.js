// Import required AWS SDK and MySQL libraries
const AWS = require('aws-sdk');
const mysql = require('mysql2/promise');

// Database connection configuration
// This connects to an AWS RDS MySQL instance
const dbConfig = {
    host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
    user: 'admin',
    password: 'SmartStride!',
    database: 'patient_data'
};

/**
 * AWS Lambda handler function for login help functionality
 * This function handles two main actions:
 * 1. Retrieving a security question for a user
 * 2. Recovering a password by verifying the answer to the security question
 * 
 * @param {Object} event - The AWS Lambda event object containing the request body
 * @returns {Object} Response object with status code and body
 */
exports.handler = async (event) => {
    let connection;
    try {
        // Parse the request body to extract action, username, answer, and userType
        const { action, username, answer, userType } = JSON.parse(event.body);
        
        // Establish connection to the MySQL database
        connection = await mysql.createConnection(dbConfig);
        
        // Determine which table to query based on userType (doctors or patients)
        const table = userType === 'doctor' ? 'doctors' : 'patients';
        
        // Handle the 'getQuestion' action - retrieve security question for a user
        if (action === 'getQuestion') {
            // Query the database for the security question associated with the username
            const [rows] = await connection.execute(
                `SELECT security_question FROM ${table} WHERE username = ?`,
                [username]
            );
            
            // If a security question is found, return it
            if (rows.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ question: rows[0].security_question }),
                };
            } else {
                // If no user is found with the given username
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'User not found' }),
                };
            }
        } 
        // Handle the 'recoverPassword' action - verify answer and return password
        else if (action === 'recoverPassword') {
            // Query the database to check if the username and answer match
            const [rows] = await connection.execute(
                `SELECT password FROM ${table} WHERE username = ? AND security_question_answer = ?`,
                [username, answer]
            );
            
            // If a matching record is found, return the password
            if (rows.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ password: rows[0].password }),
                };
            } else {
                // If the answer is incorrect
                return {
                    statusCode: 401,
                    body: JSON.stringify({ error: 'Incorrect answer' }),
                };
            }
        } else {
            // If the action is not recognized
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid action' }),
            };
        }
    } catch (error) {
        // Log any errors that occur during execution
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    } finally {
        // Always close the database connection, even if an error occurs
        if (connection) {
            await connection.end();
        }
    }
};
