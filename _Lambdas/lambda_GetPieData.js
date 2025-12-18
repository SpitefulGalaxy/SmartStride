import mysql from 'mysql2/promise';

export const handler = async (event) => {
    let connection;
    try {
        console.log('Lambda invocation started');
        console.log('Received event:', JSON.stringify(event));

        // Remove JSON.parse since event is already an object
        const { username, month, year } = event;
        
        console.log('Request parameters:', { username, month, year });
        
        // Connect to RDS
        console.log('Attempting database connection');
        connection = await mysql.createConnection({
            host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
            user: 'admin',
            password: 'SmartStride!',
            database: 'patient_data'
        });
        console.log('Database connected successfully');
        
        // SQL query to get the current month's data
        const currentMonthQuery = `
            SELECT 
                SUM(Normal) as Normal,
                SUM(Mild) as Mild,
                SUM(Moderate) as Moderate,
                SUM(Severe) as Severe,
                SUM(Total) as Total
            FROM patient_pie_data
            WHERE patient_id = ?
                AND MONTH(session_date) = ?
                AND YEAR(session_date) = ?
        `;
        
        console.log('Executing current month query');
        // Execute query for current month
        const [currentResults] = await connection.execute(
            currentMonthQuery,
            [username, month, year]
        );
        console.log('Current month results:', currentResults);
        
        // Get previous month's data for comparison
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        console.log('Executing previous month query');
        const previousMonthQuery = `
            SELECT 
                SUM(Normal) as Normal,
                SUM(Mild) as Mild,
                SUM(Moderate) as Moderate,
                SUM(Severe) as Severe,
                SUM(Total) as Total
            FROM patient_pie_data
            WHERE patient_id = ?
                AND MONTH(session_date) = ?
                AND YEAR(session_date) = ?
        `;
        
        // Execute query for previous month
        const [previousResults] = await connection.execute(
            previousMonthQuery,
            [username, prevMonth, prevYear]
        );
        console.log('Previous month results:', previousResults);
        
        // Format the response
        const response = {
            currentMonth: {
                Normal: currentResults[0].Normal || 0,
                Mild: currentResults[0].Mild || 0,
                Moderate: currentResults[0].Moderate || 0,
                Severe: currentResults[0].Severe || 0,
                Total: currentResults[0].Total || 0,
                month,
                year
            },
            previousMonth: {
                Normal: previousResults[0].Normal || 0,
                Mild: previousResults[0].Mild || 0,
                Moderate: previousResults[0].Moderate || 0,
                Severe: previousResults[0].Severe || 0,
                Total: previousResults[0].Total || 0,
                month: prevMonth,
                year: prevYear
            }
        };
        
        console.log('Formatted response:', response);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        console.error('Error in lambda:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Error fetching pie chart data',
                error: error.message
            })
        };
    } finally {
        if (connection) {
            console.log('Closing database connection');
            await connection.end();
        }
        console.log('Lambda execution completed');
    }
};