import bluetooth
import csv
import time
import struct
import sys

# Define the struct format ( 6 floats: accelX, accelY, accelZ, gyroX, gyroY, gyroZ, EMG)
IMU_DATA_FORMAT = "ffffff"  # 6 floats (24 bytes total)

def find_esp32():
    print("Scanning for Bluetooth devices...")
    nearby_devices = bluetooth.discover_devices(duration=8, lookup_names=True)
    for addr, name in nearby_devices:
        print(f"Found device: {name} - {addr}")
        if name == "ESP32_Sensors":  # Match the ESP32's Bluetooth name
            print(f"Found ESP32: {addr}")
            return addr
    return None

def connect_to_esp32(address):
    #    esp32_address = "XX:XX:XX:XX:XX:XX"  # Replace with your ESP32's Bluetooth address
    #   sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    #   sock.connect((esp32_address, 1))
    print(f"Connecting to ESP32 at {address}...")
    sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    sock.connect((address, 1))  # Channel 1 is typically used for SPP
    print("Connected to ESP32!")
    return sock

def receive_imu_data(sock):
    # Read the size of the struct
    data = sock.recv(struct.calcsize(IMU_DATA_FORMAT))
    if len(data) == struct.calcsize(IMU_DATA_FORMAT):
        imu_data = struct.unpack(IMU_DATA_FORMAT, data)
        return imu_data
    return None

def record_data(sock, duration=300):
    print(f"Recording data for {duration} seconds...")
    filename = f"sensor_data_{int(time.time())}.csv"
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        # Write CSV header
        writer.writerow([
            "Timestamp",
            "IMU1_AccelX", "IMU1_AccelY", "IMU1_AccelZ",
            "IMU1_GyroX", "IMU1_GyroY", "IMU1_GyroZ",
            "IMU2_AccelX", "IMU2_AccelY", "IMU2_AccelZ",
            "IMU2_GyroX", "IMU2_GyroY", "IMU2_GyroZ",
            "IMU3_AccelX", "IMU3_AccelY", "IMU3_AccelZ",
            "IMU3_GyroX", "IMU3_GyroY", "IMU3_GyroZ"
        ])

        start_time = time.time()
        while time.time() - start_time < duration:
            try:
                # Receive and unpack data for IMU1
                imu1_data = receive_imu_data(sock)
                if not imu1_data:
                    print("Failed to receive IMU1 data.")
                    continue

                # Receive and unpack data for IMU2
                imu2_data = receive_imu_data(sock)
                if not imu2_data:
                    print("Failed to receive IMU2 data.")
                    continue

                # Receive and unpack data for IMU3
                imu3_data = receive_imu_data(sock)
                if not imu3_data:
                    print("Failed to receive IMU3 data.")
                    continue

                # Get the current timestamp
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

                # Write the data to the CSV file
                writer.writerow([
                    timestamp,
                    *imu1_data,  # Unpack IMU1 data
                    *imu2_data,  # Unpack IMU2 data
                    *imu3_data   # Unpack IMU3 data
                ])

                # Print the data to the console
                print(f"{timestamp}: IMU1={imu1_data}, IMU2={imu2_data}, IMU3={imu3_data}")

            except Exception as e:
                print(f"Error receiving data: {e}")
                break

    print(f"Data recording complete. Saved to {filename}")


def main():
    
    # Check if duration is passed as a command-line argument
    if len(sys.argv) < 2:
        print("Usage: python bluetooth-IMU-variabletime.py <duration_in_seconds>")
        return

    try:
        duration = int(sys.argv[1])  # Get duration from command-line argument
    except ValueError:
        print("Invalid duration. Please provide an integer value for seconds.")
        return
    
    esp32_address = find_esp32()
    if not esp32_address:
        print("ESP32 not found. Exiting...")
        return

    sock = connect_to_esp32(esp32_address)

    
    print(f"Recording for {duration // 60} minute(s)...")
    record_data(sock, duration=duration * 60)


    sock.close()
    print("Disconnected from ESP32.")
    
    return

if __name__ == "__main__":
    main()
