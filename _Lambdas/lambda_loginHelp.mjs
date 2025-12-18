import mysql from 'mysql2/promise';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Configure the MySQL connection
const dbConfig = {
    host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
    user: 'admin',
    password: 'SmartStride!',
    database: 'patient_data'
};

export const handler = async (event) => {
    let connection;
    try {
        console.log('Received event:', JSON.stringify(event, null, 2));
        let parsedBody;
        if (typeof event.body === 'string') {
            parsedBody = JSON.parse(event.body);
        } else if (typeof event.body === 'object') {
            parsedBody = event.body;
        } else {
            throw new Error('Invalid event body');
        }

        const { action, username, userType } = parsedBody;
        
        console.log('Parsed body:', JSON.stringify(parsedBody, null, 2));
        console.log('Username:', username);
        console.log('UserType:', userType);
        
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database successfully');

        // Determine which table to query based on userType
        const table = userType === 'doctor' ? 'doctors' : 'patients';
        
        console.log('Table:', table);
        
        if (action === 'getQuestion') {
            const query = `SELECT security_question, security_question_answer FROM ${table} WHERE username = ?`;
            console.log('Executing query:', query);
            console.log('Query parameters:', [username]);

            const [rows] = await connection.execute(query, [username]);
            
            console.log('Query result:', JSON.stringify(rows, null, 2));
            
            if (rows.length > 0) {
                console.log('User found, returning security question');
                const response = {
                    statusCode: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                        "Access-Control-Allow-Headers": "Content-Type",
                        "Access-Control-Allow-Methods": "OPTIONS,POST"
                    },
                    body: JSON.stringify({ 
                        question: rows[0].security_question,
                        answer: rows[0].security_question_answer
                    }),
                };
                console.log('Sending response:', JSON.stringify(response, null, 2));
                return response;
            } else {
                console.log('User not found');
                return {
                    statusCode: 404,
                    headers: {
                        "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                        "Access-Control-Allow-Headers": "Content-Type",
                        "Access-Control-Allow-Methods": "OPTIONS,POST"
                    },
                    body: JSON.stringify({ error: 'User not found' }),
                };
            }
        } else if (action === 'verifyAnswer') {
            const { username, userType, answer } = parsedBody;
            console.log('Verifying answer for:', { username, userType, answer });
            const query = `SELECT security_question_answer FROM ${table} WHERE username = ?`;
            const [rows] = await connection.execute(query, [username]);
            console.log('Database response:', rows);

            if (rows.length > 0) {
                const storedAnswer = rows[0].security_question_answer.replace(/\\"/g, '"');
                console.log('Stored answer:', storedAnswer);
                console.log('Provided answer:', answer);
                console.log('Comparison result:', storedAnswer.toLowerCase().trim() === answer.toLowerCase().trim());
                
                if (storedAnswer.toLowerCase().trim() === answer.toLowerCase().trim()) {
                    return {
                        statusCode: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                            "Access-Control-Allow-Headers": "Content-Type",
                            "Access-Control-Allow-Methods": "OPTIONS,POST"
                        },
                        body: JSON.stringify({ verified: true }),
                    };
                } else {
                    return {
                        statusCode: 400,
                        headers: {
                            "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                            "Access-Control-Allow-Headers": "Content-Type",
                            "Access-Control-Allow-Methods": "OPTIONS,POST"
                        },
                        body: JSON.stringify({ verified: false }),
                    };
                }
            } else {
                return {
                    statusCode: 404,
                    headers: {
                        "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                        "Access-Control-Allow-Headers": "Content-Type",
                        "Access-Control-Allow-Methods": "OPTIONS,POST"
                    },
                    body: JSON.stringify({ error: 'User not found' }),
                };
            }
        } else if (action === 'setNewPassword') {
            const { username, userType, newPassword } = parsedBody;
            console.log('Setting new password for:', { username, userType });
            
            // Hash the new password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            const updateQuery = `UPDATE ${table} SET password = ? WHERE username = ?`;
            await connection.execute(updateQuery, [hashedPassword, username]);

            console.log('Password reset successful');
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST"
                },
                body: JSON.stringify({ success: true }),
            };
        } else {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST"
                },
                body: JSON.stringify({ error: 'Invalid action' }),
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "https://staging.d13od11ajb8vtt.amplifyapp.com",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            body: JSON.stringify({ error: 'Internal server error', details: error.message }),
        };
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};
