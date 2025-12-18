import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';

export const handler = async (event) => {
    let connection;
    try {
        // Parse the event body
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { csvData, patientId } = body;
        
        // Split CSV into rows and columns and determine data type
        // if 2 rows and 3+ columns, then it is pie chart data
        // if 2+ rows and 3 columns, then it is angle data
        // if 2 rows and 2 columns, then it is emg data
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        const columns = rows[0].split(',');
        let isAngleData = false;
        let isPieData = false;
        let isEmgData = false;
        let isNewPieData = false;

        if (columns.length > 3) {
            isAngleData = false;
            isPieData = true; // pie chart data
            isEmgData = false;
            isNewPieData = false;
        } else if (rows.length > 2) {
            isAngleData = true; // angle data
            isPieData = false;
            isEmgData = false;
            isNewPieData = false;
        } else if (rows.length === 2 && columns.length === 2) {
            isAngleData = false; 
            isPieData = false;
            isEmgData = true; // emg data
            isNewPieData = false;
        } else if (rows.length === 2 && columns.length === 3) {
            isAngleData = false; 
            isPieData = false;
            isEmgData = false;
            isNewPieData = true; // New pie chart data
        }


        
        console.log('Parsed body - patientId:', patientId);
        console.log('Number of rows:', rows.length);
        console.log('Number of columns:', columns.length);
        console.log('Data type:', isAngleData ? 'angle' : isPieData ? 'pie chart' : 'emg');

        // Connect to RDS
        connection = await mysql.createConnection({
            host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
            user: 'admin',
            password: 'SmartStride!',
            database: 'patient_data'
        });
        console.log('Database connected successfully');




        // Handle session data upload
        if (isAngleData === true) {
            // Get the last session ID for this patient
            const [lastSession] = await connection.execute(
                'SELECT MAX(session_id) as last_session FROM patient_angle_data WHERE patient_id = ?',
                [patientId]
            );

            console.log('Last session ID from database:', lastSession[0].last_session);
            let newSessionId = (lastSession[0].last_session || 0) + 1;
            console.log('Initial new session ID:', newSessionId);

            // Increment session ID until a unique one is found
            let isUnique = false;
            while (!isUnique) {
                const [existingSession] = await connection.execute(
                    'SELECT COUNT(*) as count FROM patient_angle_data WHERE patient_id = ? AND session_id = ?',
                    [patientId, newSessionId]
                );

                console.log('Existing session count for session ID', newSessionId, ':', existingSession[0].count);

                if (existingSession[0].count === 0) {
                    isUnique = true;
                } else {
                    newSessionId += 1;
                    console.log('Incremented new session ID:', newSessionId);
                }
            }

            console.log('(Angle) Final new session ID:', newSessionId);

            // Parse session data rows, skipping the header
            const sessionRows = rows.slice(1).map(row => {
                const values = row.split(',');
                if (values.length < 3) return null;
                return {
                    Time_: values[1],
                    Angle: values[2],
                };
            }).filter(row => row !== null);

            const query = `
                INSERT INTO patient_angle_data (
                    patient_id, session_id, session_date, Time_,
                    Angle
                ) VALUES ?
            `;

            const values = sessionRows.map(row => [
                patientId,
                newSessionId,
                new Date(),
                row.Time_,
                row.Angle
            ]);

            console.log('Attempting to insert angle data with session ID:', newSessionId);
            console.log('Values to be inserted:', values);

            const [result] = await connection.query(query, [values]);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Angle data uploaded successfully',
                    rowsInserted: result.affectedRows,
                    sessionId: newSessionId
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };




        } else if (isEmgData === true) {
            // Handle EMG data upload
            console.log('EMG data detected');
            // Get the last session ID for this patient
            const [lastSession] = await connection.execute(
                'SELECT MAX(session_id) as last_session FROM patient_emg_data WHERE patient_id = ?',
                [patientId]
            );

            const newSessionId = (lastSession[0].last_session || 0) + 1;
            console.log('(EMG) New session ID:', newSessionId);

            // Skip header row and get data row
            const emgData = rows[1].split(',');

            const query = `
                INSERT INTO patient_emg_data (
                    patient_id, session_id, session_date, 
                    EMG_Time
                ) VALUES (?, ?, ?, ?)
            `;

            const [emgResult] = await connection.query(query, [
                patientId,
                newSessionId,
                new Date(),
                sanitizeValue(parseFloat(emgData[1]))
            ]);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'EMG data uploaded successfully',
                    rowsInserted: emgResult.affectedRows,
                    sessionId: newSessionId
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };

        } else if (isPieData === true) {
            // Get the last session ID for this patient - do this first for both data types
            const [lastSession] = await connection.execute(
                'SELECT MAX(session_id) as last_session FROM patient_pie_data WHERE patient_id = ?',
                [patientId]
            );

            const newSessionId = (lastSession[0].last_session || 0) + 1;
            console.log('(Pie Chart) New session ID:', newSessionId);

            // Skip header row and get data row
            const pieData = rows[1].split(',');
            
            const pieChartQuery = `
                INSERT INTO patient_pie_data (
                    patient_id,
                    session_id,
                    session_date,
                    Normal,
                    Mild,
                    Moderate,
                    Severe,
                    Total
                ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
            `;

            const [pieResult] = await connection.execute(pieChartQuery, [
                patientId,
                newSessionId,  // Use the same newSessionId here
                parseInt(pieData[0]), // Normal
                parseInt(pieData[1]), // Mild
                parseInt(pieData[2]), // Moderate
                parseInt(pieData[3]), // Severe
                parseInt(pieData[4])  // Total
            ]);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Pie chart data uploaded successfully',
                    rowsInserted: pieResult.affectedRows,
                    sessionId: newSessionId
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } else if (isNewPieData === true) {
             // Get the last session ID for this patient - do this first for both data types
             const [lastSession] = await connection.execute(
                'SELECT MAX(session_id) as last_session FROM patient_pie_data WHERE patient_id = ?',
                [patientId]
            );

            const newSessionId = (lastSession[0].last_session || 0) + 1;
            console.log('(Pie Chart) New session ID:', newSessionId);

            // Skip header row and get data row
            const pieData = rows[1].split(',');
            
            const pieChartQuery = `
                INSERT INTO patient_pie_data (
                    patient_id,
                    session_id,
                    session_date,
                    Normal,
                    Mild,
                    Moderate,
                    Severe,
                    Total
                ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
            `;

            const [pieResult] = await connection.execute(pieChartQuery, [
                patientId,
                newSessionId,  // Use the same newSessionId here
                parseInt(pieData[1]), // Normal
                parseInt(0), // Mild
                parseInt(0), // Moderate
                parseInt(pieData[0]), // Severe
                parseInt(pieData[2])  // Total
            ]);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Pie chart data uploaded successfully',
                    rowsInserted: pieResult.affectedRows,
                    sessionId: newSessionId
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
        

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error uploading data',
                error: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    } finally {
        if (connection) await connection.end();
    }
};

function sanitizeValue(value) {
    if (value === '' || value === undefined || value === null || Number.isNaN(value)) {
        return null;
    }
    return value;
}