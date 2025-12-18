import mysql from 'mysql2/promise'; // Use import for mysql2
import bcrypt from 'bcryptjs'; 

export const handler = async (event) => {
  let connection;
  try {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = event.body; // If it's already an object, use it as is
    }
    
    const { username, password, userType } = body; // Add userType to differentiate
    console.log('Username:', username); // Log the username for debugging
    console.log('Password:', password); // Log the password (consider removing this in production)
    console.log('User Type:', userType);

    connection = await mysql.createConnection({
      host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: 'SmartStride!',
      database: 'patient_data' // Make sure this is correct
    });

    // Determine which table to query based on userType
    const table = userType === 'practitioner' ? 'doctors' : 'patients';

    // Fetch the user by username
    const [results] = await connection.execute(`SELECT * FROM ${table} WHERE username = ?`, [username]);
    console.log('Database Results:', results);

    // Check if user exists
    if (results.length === 0) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ message: 'User not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Check if password matches
    const storedPassword = results[0].password; 
    console.log('Stored Password:', storedPassword); // Log the stored hashed password

    const isMatch = await bcrypt.compare(password, storedPassword);
    console.log('Password Match:', isMatch); // Log the result of password comparison

    if (isMatch) {
      // Remove sensitive information before sending
      const userData = {
        username: results[0].username,
        first_name: results[0].first_name,
        last_name: results[0].last_name,
        // Change this line to include the doctor's name directly
        doctor: userType === 'patient' ? results[0].doctor : undefined,
        // Include patients_list only for doctors
        patients_list: userType === 'practitioner' ? results[0].patients_list : undefined,
      };
      
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Login successful', 
          userType,
          userData 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    } else {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ message: 'Invalid credentials' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  } catch (error) {
    console.error('Error occurred:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  } finally {
    if (connection) await connection.end(); // Close the connection if it was opened
  }
};
