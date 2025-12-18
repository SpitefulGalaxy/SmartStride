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

    // Update the doctor's patients_list by removing the patient
    const updateDoctorQuery = `UPDATE doctors 
                               SET patients_list = JSON_REMOVE(
                                 patients_list,
                                 JSON_UNQUOTE(JSON_SEARCH(patients_list, 'one', ?))
                               )
                               WHERE username = ? AND JSON_SEARCH(patients_list, 'one', ?) IS NOT NULL`;
    const [updateDoctorResult] = await connection.execute(updateDoctorQuery, [patientUsername, clinicianUsername, patientUsername]);
    console.log('Update doctor result:', JSON.stringify(updateDoctorResult));

    if (updateDoctorResult.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Patient not found in clinician list' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Remove the doctor's username from the patient's record
    const updatePatientQuery = "UPDATE patients SET doctor = NULL WHERE username = ? AND doctor = ?";
    const [updatePatientResult] = await connection.execute(updatePatientQuery, [patientUsername, clinicianUsername]);
    console.log('Update patient result:', JSON.stringify(updatePatientResult));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Patient removed successfully' }),
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
