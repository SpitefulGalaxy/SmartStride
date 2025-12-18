import mysql from 'mysql2/promise'; // Use import for mysql2
import bcrypt from 'bcryptjs'; 

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));
  
  let connection;
  try {
    // Parse the event body if it's a string
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { firstName, lastName, userType, doctorUsername, securityQuestion, securityAnswer, username, password } = body;
    console.log('Parsed body:', JSON.stringify(body));

    connection = await mysql.createConnection({
      host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: 'SmartStride!',
      database: 'patient_data'
    });

    console.log('Connected to database');

    const isPatient = userType === 'patient';
    const table = isPatient ? 'patients' : 'doctors';

    // Check if username already exists
    const [existingUsers] = await connection.execute(`SELECT * FROM ${table} WHERE username = ?`, [username]);
    if (existingUsers.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username already exists' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    let query, values;
    if (isPatient) {
      query = `INSERT INTO ${table} (username, password, first_name, last_name, security_question, security_question_answer, doctor) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      values = [username, hashedPassword, firstName, lastName, securityQuestion, securityAnswer, doctorUsername];
      await connection.execute(query, values);

      const updateDoctorQuery = `UPDATE doctors 
                                SET patients_list = JSON_ARRAY_APPEND(
                                  COALESCE(patients_list, JSON_ARRAY()),
                                  '$',
                                  ?
                                )
                                WHERE username = ?`;
      await connection.execute(updateDoctorQuery, [username, doctorUsername]);
    } else {
      query = `INSERT INTO ${table} (username, password, first_name, last_name, security_question, security_question_answer, patients_list) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      values = [username, hashedPassword, firstName, lastName, securityQuestion, securityAnswer, JSON.stringify([])];
    }

    console.log('Executing query:', query);
    console.log('Query values:', JSON.stringify(values));

    const [result] = await connection.execute(query, values);
    console.log('Query result:', JSON.stringify(result));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User registered successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  } finally {
    if (connection) await connection.end();
  }
};
