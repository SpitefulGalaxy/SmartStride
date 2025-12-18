import mysql from 'mysql2/promise';

export const handler = async (event) => {
  let connection;
  try {
    console.log('Received event:', JSON.stringify(event));

    // Handle both string and object body formats
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      console.error('Error parsing body:', e);
      body = event.body;
    }
    
    console.log('Parsed body:', JSON.stringify(body));
    
    if (!body || !body.username) {
      console.error('Missing username in request');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Username is required',
          receivedBody: body 
        }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
    }

    const { username } = body;
    console.log('Username to look up:', username);
    
    connection = await mysql.createConnection({
      host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: 'SmartStride!',
      database: 'patient_data'
    });

    console.log('Connected to database');

    // First try to find the user in the patients table
    let query = `
        SELECT p.username, p.first_name, p.last_name, 
               p.doctor as doctor_username,
               d.first_name as doctor_first_name, 
               d.last_name as doctor_last_name 
        FROM patients p
        LEFT JOIN doctors d ON p.doctor = d.username 
        WHERE p.username = ?`;
    
    let [results] = await connection.execute(query, [username]);
    
    // If not found in patients table, check doctors table
    if (results.length === 0) {
        query = `
            SELECT username, first_name, last_name
            FROM doctors
            WHERE username = ?`;
        
        [results] = await connection.execute(query, [username]);
        
        if (results.length === 0) {
            console.log('No user found with username:', username);
            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    message: 'User not found',
                    searchedUsername: username 
                }),
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            };
        }
        
        // If found in doctors table, return doctor information
        const responseBody = {
            message: 'Doctor found',
            patientData: {
                username: results[0].username,
                first_name: results[0].first_name,
                last_name: results[0].last_name,
                is_doctor: true
            }
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify(responseBody),
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
    }

    // If found in patients table, return patient information
    const responseBody = {
        message: 'Patient found',
        patientData: {
            username: results[0].username,
            first_name: results[0].first_name,
            last_name: results[0].last_name,
            doctor: results[0].doctor_username,
            doctor_first_name: results[0].doctor_first_name,
            doctor_last_name: results[0].doctor_last_name
        }
    };
    
    console.log('Sending response:', JSON.stringify(responseBody));

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  } catch (error) {
    console.error('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Internal Server Error', 
        error: error.message,
        stack: error.stack // Include stack trace for debugging
      }),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('Database connection closed');
      } catch (err) {
        console.error('Error closing database connection:', err);
      }
    }
  }
}; 