import shutil
import tkinter as tk
from tkinter import ttk, messagebox
import requests
import json
import os
from time import sleep
import threading
import subprocess

class CSVUploaderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("SmartStride CSV Uploader")
        self.root.geometry("400x500")
       
        # Variables
        self.patient_id = tk.StringVar()
        self.selected_time = tk.StringVar()
        self.is_running = False
        self.watch_directory = "C:/Users/ciann/Desktop/Code/Senior_Design/Code/_PiGUI/CSV_Files" #"/home/smartstride/Website/CSV_Files"  # default directory (can change the file you want to pull from)
        self.api_endpoint = "https://efub6po1y2.execute-api.us-east-2.amazonaws.com/UserPassTest/DragDropHandler"  # API endpoint DONT DELETE OR CHANGE
        self.start_path = r"C:/Users/ciann/Desktop/Code/Senior_Design/Code/_PiGUI/CSV_Files"
        self.dest_path = r"C:/Users/ciann/Desktop/Code/Senior_Design/Code/_PiGUI/Archived CSV Files"
        #self.start_path = r"/home/smartstride/Website/CSV_Files"
        #self.dest_path = r"/home/smartstride/Website/Archived CSV Files"
        
        # Initialize time options
        self.time_options = ["1 min", "2 min", "3 min", "4 min", "5 min", "10 min", "Demo"]
        self.selected_time.set(self.time_options[0])  # Set default value (1 min)
       
        # Create GUI elements
        self.create_widgets()
       
        # Log display
        self.log_text = tk.Text(root, height=15, width=45)
        self.log_text.pack(pady=10, padx=10)
        
        
       
    def create_widgets(self):
        style = ttk.Style()
        #style.configure("TButton", foreground="black", background="lightblue")
        #style.configure("LabelFrame", background="lightblue")
        
        # Patient ID Frame
        id_frame = ttk.LabelFrame(self.root, text="Patient Information", padding="10")
        id_frame.pack(fill="x", padx=10, pady=5)
       
        ttk.Label(id_frame, text="Patient ID:").pack(side="left", padx=5)
        ttk.Entry(id_frame, textvariable=self.patient_id).pack(side="left", padx=5, fill="x", expand=True)
       
        # Time Selection Frame
        time_frame = ttk.LabelFrame(self.root, text="Monitoring Interval", padding="10")
        time_frame.pack(fill="x", padx=10, pady=5)
        
        ttk.Label(time_frame, text="Select Time:").pack(side="left", padx=5)
        time_dropdown = ttk.Combobox(time_frame, textvariable=self.selected_time, values=self.time_options, state="readonly")
        time_dropdown.pack(side="left", padx=5, fill="x", expand=True)
       
        # Control Buttons
        btn_frame = ttk.Frame(self.root)
        btn_frame.pack(pady=10)
       
        self.start_btn = ttk.Button(btn_frame, text="Start Monitoring", command=self.start_monitoring)
        self.start_btn.pack(side="left", padx=5)
       
        self.stop_btn = ttk.Button(btn_frame, text="Stop", command=self.stop_monitoring, state="disabled")
        self.stop_btn.pack(side="left", padx=5)
        
    def start_recording(self):
        # Extract the integer value from the selected time
        selected_time_str = self.selected_time.get()  # e.g., "1 min"
        duration = selected_time_str.split(" ") 
        
        try:
            # Call the external script and pass the duration as an argument
            subprocess.run(["python", "bluetooth-IMU-variabletime_N.py", duration[0]])
            self.log_message("✅ Recording completed.")
        except ValueError:
            self.log_message("❌ Invalid time format selected.")

        self.log_message("✅ ML start please sweet jesus.")

        try:
            # Call the external script and pass the duration as an argument
            self.log_message("✅ ML started.")
            subprocess.run(["python", "ITW_Classification_V5_N.py"])
            self.log_message("✅ ML completed.")
        except ValueError:
            self.log_message("❌ ML Error")
            
    #def trigger_ML(self):
        #try:
            ## Call the external script and pass the duration as an argument
            #self.log_message("✅ ML started.")
            #subprocess.run(["python", "/home/smartstride/machine-learning/ITW_Classification_V5.py"])
            #self.log_message("✅ ML completed.")
        #except ValueError:
            #self.log_message("❌ ML Error")


    def recording_thread(self):
        # Extract the integer value from the selected time
        selected_time_str = self.selected_time.get()  # e.g., "1 min"
        duration = selected_time_str.split(" ")
        
        try:
            # Call the external script and pass the duration as an argument
            subprocess.run(["python", "bluetooth-IMU-variabletime_N.py", duration[0]])
            self.log_message("✅ Recording completed.")
            
        except ValueError:
            self.log_message("❌ Invalid time format selected.")
        finally:
            # Re-enable the start button and disable the stop button when recording is done
            self.start_btn.config(state="normal")
            self.stop_btn.config(state="disabled")

    # This is just to format the messages in the apps log
    def log_message(self, message):
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")


    # This is where the app connects to the website using the API and uploads the CSV
    # Response is sent from API to app and displays it 
    def upload_csv(self, file_path):
        try:
            with open(file_path, 'r') as file:
                csv_data = file.read()
                #/home/smartstride/Website/bela_GUI_test
           # To keep track of whose data goes to who we need to give the API the username
            payload = {
                "csvData": csv_data,
                "patientId": self.patient_id.get()
            }
           
           # Here is where we read the response from the API
            response = requests.post(
                self.api_endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
           
           # 200 response means YAY!
            if response.status_code == 200:
                self.log_message(f"✅ Successfully uploaded {os.path.basename(file_path)}")
                return True
            else: # Anything is a tragedy...
                self.log_message(f"❌ Failed to upload {os.path.basename(file_path)}")
                self.log_message(f"Error: {response.text}")
                return False
        
        # If its an error print that error
        except Exception as e: 
            self.log_message(f"❌ Error uploading {os.path.basename(file_path)}: {str(e)}")
            return False

    # We gotta keep an eye on that folder 
    def watch_directory_thread(self):
        processed_files = set() # Keep track of already uploaded files (probably should delete this now  _  O  _
        # Honestly we should probably move or delete the files after they have been uploaded... (did it)  \ | /
        self.log_message("🔍 Started monitoring for CSV files...") #                                      """
       
        while self.is_running:
            try:
                for filename in os.listdir(self.watch_directory):
                    if filename.endswith('.csv') and filename not in processed_files:
                        file_path = os.path.join(self.watch_directory, filename)
                        self.log_message(f"📁 New file detected: {filename}")
                       
                        if self.upload_csv(file_path):
                            processed_files.add(filename)
                            # Move the file when were done uploading it 
                            # Kinda means we dont need the processed_files stuff but oh well we have back ups now 
                            shutil.move(self.start_path + "/" + filename, self.dest_path + "/" + filename) 
                            
               
            except Exception as e:
                self.log_message(f"❌ Error: {str(e)}")


        
    # This is the class that the button starts up and probably the class you want to edit <<------------ LOOK HERE! lol
    def start_monitoring(self):
        #This just turns the start button off and the off button on in the GUI (Greys them out)
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        
        if not self.patient_id.get():
            messagebox.showerror("Error", "Please enter a Patient ID")
            self.stop_monitoring() #buttons need to change back to default
            return
            
        self.log_message(f"⏱️ Starting recording for {self.selected_time.get()} minute(s)...")
        
        # Start the recording in a separate thread
        self.recording_thread_instance = threading.Thread(target=self.recording_thread)
        self.recording_thread_instance.daemon = True
        self.recording_thread_instance.start()
           
        self.is_running = True
        
        
        # Start monitoring the folder
        self.monitor_thread = threading.Thread(target=self.watch_directory_thread)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    # You guessed it this one is the stop button and it stops lol
    def stop_monitoring(self):
        self.is_running = False
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.log_message("⏹️ Monitoring stopped")

if __name__ == "__main__":
    root = tk.Tk()
    app = CSVUploaderApp(root)
    root.mainloop()
