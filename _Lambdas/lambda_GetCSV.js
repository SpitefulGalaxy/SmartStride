import mysql from 'mysql2/promise';

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

        const { username } = parsedBody;
        console.log('Username/patient_id to look up:', username);

        // Configure the MySQL connection
        const dbConfig = {
            host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
            user: 'admin',
            password: 'SmartStride!',
            database: 'patient_data'
        };

        // Create connection
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database');

        // Fetch the session data using username as patient_id
        const query = 'SELECT Time_, Angle FROM patient_angle_data WHERE patient_id = ? ORDER BY Time_';
        console.log('Executing query:', query, 'with patient_id:', username);
        
        const [rows] = await connection.execute(query, [username]);
        console.log('Found', rows.length, 'angle data records');
        
        if (rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'No angle data found for this user'
                })
            };
        }

        // Fetch the EMG time for the session
        const emgQuery = 'SELECT EMG_Time FROM patient_emg_data WHERE patient_id = ? ORDER BY session_date DESC LIMIT 1';
        console.log('Executing EMG query:', emgQuery, 'with patient_id:', username);

        const [emgRows] = await connection.execute(emgQuery, [username]);
        console.log('Found EMG time records:', emgRows);

        if (emgRows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'No EMG time found for this user'
                })
            };
        }

        const emgTime = emgRows[0].EMG_Time;

        // Process and reduce the data
        const processedData = rows.map(row => ({
            time: parseFloat(row.Time_),
            angle: parseFloat(row.Angle)
        }));

        // Reduce number of points (take every Nth point)
        const samplingRate = 10; // Adjust this number to show more or fewer points
        const reducedData = processedData.filter((_, index) => index % samplingRate === 0);

        // Apply moving average smoothing
        const windowSize = 5; // Adjust this for more or less smoothing
        const smoothedData = reducedData.map((point, index, array) => {
            if (index < windowSize - 1) return point;
            
            const window = array.slice(index - windowSize + 1, index + 1);
            const avgAngle = window.reduce((sum, p) => sum + p.angle, 0) / windowSize;
            
            return {
                time: point.time,
                angle: avgAngle
            };
        });

        console.log('Reduced data points from', rows.length, 'to', smoothedData.length);
        console.log('Sample of processed data:', smoothedData.slice(0, 5));

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Data retrieved successfully',
                sessionData: smoothedData,
                emgTime: emgTime
            })
        }; 

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error retrieving session data',
                error: error.message
            })
        };
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};


