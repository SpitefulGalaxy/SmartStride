import mysql from 'mysql2/promise';

export const handler = async (event) => {
    let connection;
    try {
        console.log('Received event:', JSON.stringify(event));
        
        // Parse the body first
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        console.log('Parsed body:', body);

        // Validate required fields
        if (!body.action || !body.username) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required fields' }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }

        // Connect to database
        connection = await mysql.createConnection({
            host: 'patientdata.cbg8ucgomro2.us-east-2.rds.amazonaws.com',
            user: 'admin',
            password: 'SmartStride!',
            database: 'patient_data'
        });

        console.log('Connected to database');

        switch (body.action) {
            case 'getGoals':
                console.log('Fetching goals for:', body.username);
                const [goals] = await connection.execute(
                    'SELECT * FROM patient_goals WHERE patient_id = ? ORDER BY created_at DESC',
                    [body.username]
                );
                console.log('Found goals:', goals);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        message: 'Goals retrieved successfully',
                        goals: goals 
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };

            case 'addGoal':
                console.log('Adding goal for:', body.username, 'Goal:', body.goals);
                const [result] = await connection.execute(
                    'INSERT INTO patient_goals (patient_id, goal_description, completed) VALUES (?, ?, false)',
                    [body.username, body.goals]
                );
                console.log('Insert result:', result);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Goal added successfully' }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };

            case 'updateGoal':
                console.log('Updating goal:', body.goalId, 'Completed:', body.completed);
                await connection.execute(
                    'UPDATE patient_goals SET completed = ? WHERE id = ? AND patient_id = ?',
                    [body.completed, body.goalId, body.username]
                );
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Goal updated successfully' }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };

            case 'deleteGoal':
                console.log('Deleting goal:', body.goalId);
                await connection.execute(
                    'DELETE FROM patient_goals WHERE id = ? AND patient_id = ?',
                    [body.goalId, body.username]
                );
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Goal deleted successfully' }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };

            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Invalid action' }),
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
                message: 'Internal server error', 
                error: error.message 
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
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