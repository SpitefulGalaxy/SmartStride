import mysql from 'mysql2/promise';

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  let connection;
  try {
    // Parse the event body if it's a string
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { clinicianUsername, patientUsername } = body;
    console.log('Parsed body:', JSON.stringify(body));

    connection = await mysql.createConnection({
      host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
      user: 'admin',
      password: 'SmartStride!',
      database: 'patient_data'
    });

    console.log('Connected to database');

    // First check if the patient already has a doctor
    const checkPatientQuery = 'SELECT doctor FROM patients WHERE username = ?';
    const [patientResult] = await connection.execute(checkPatientQuery, [patientUsername]);
    
    if (patientResult.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Patient not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    if (patientResult[0].doctor !== null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Patient already has a doctor assigned' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Check if patient is already in doctor's list
    const checkDoctorQuery = 'SELECT patients_list FROM doctors WHERE username = ?';
    const [doctorResult] = await connection.execute(checkDoctorQuery, [clinicianUsername]);
    
    if (doctorResult.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Clinician not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Handle the patients list with more detailed logging
    let patientsList = [];
    if (doctorResult[0].patients_list) {
      console.log('Current patients_list:', doctorResult[0].patients_list);
      try {
        // If it's already a JSON string array
        if (Array.isArray(doctorResult[0].patients_list)) {
          patientsList = doctorResult[0].patients_list;
        } else {
          patientsList = JSON.parse(doctorResult[0].patients_list);
        }
      } catch (e) {
        console.log('Error parsing patients_list:', e);
        // If parsing fails, try treating it as a single value
        patientsList = [doctorResult[0].patients_list];
      }
    }
    console.log('Parsed patients_list:', patientsList);

    // Check if patient is already in the list
    if (patientsList.includes(patientUsername)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Patient is already in your list' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Update the patient's doctor
    const updatePatientQuery = 'UPDATE patients SET doctor = ? WHERE username = ?';
    await connection.execute(updatePatientQuery, [clinicianUsername, patientUsername]);

    // Update the doctor's patients_list
    const newPatientsList = JSON.stringify([...patientsList, patientUsername]);
    const updateDoctorQuery = 'UPDATE doctors SET patients_list = ? WHERE username = ?';
    const [updateResult] = await connection.execute(updateDoctorQuery, [newPatientsList, clinicianUsername]);
    console.log('Update result:', JSON.stringify(updateResult));

    if (updateResult.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Clinician not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Patient added successfully' }),
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