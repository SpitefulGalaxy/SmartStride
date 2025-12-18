#!/usr/bin/env/ python3
# -*- coding: utf-8 -*-
"""
Main ITW Classification Script
Alec Anzalone
3/25/25
"""
from Main.IMU.imu_preprocess import imu_preprocessing
from Main.EMG.emg_preprocess import emg_preprocessing
from Main.features import arrange_features, feature_df
from Main.figures import website_figure_1
import pandas as pd
import numpy as np
import pickle
import re
import os

def itw_classification(imu_file,fs_imu,emg_file=None,fs_emg=None):

    step_features, _, _, _, _ = feature_df()

    # IMU
    imu_features = imu_preprocessing(imu_file,fs_imu)  # get imu_features
    steps = imu_features[1]  # step location index in samples
    imu_time = imu_features[0]  # time vector for IMU
    kalman_signal = imu_features[-1]  # kalman filtered epochs
    # EMG
    try:
        emg_features = emg_preprocessing(emg_file, steps, fs_emg, fs_imu)  # get emg features
        max_act_loc = emg_features[-1]  # max activation location in samples, related to -0.5 to 0.5s time vector
    except:
        emg_features = ([],[],[],[],[],[],[],[])

    features = arrange_features(emg_features, imu_features)

    # get ML feature vector
    step_features = pd.concat([step_features, features], ignore_index=True)

    # ML classification
    # best features
    best_features = ['acc_mean_z_bridge', 'acc_std_x_ball', 'acc_mean_z_ball', 'gyr_skew_x_bridge', 'acc_skew_z_bridge',
                     'gyr_min_x_bridge', 'gyr_skew_y_heel', 'gyr_mean_f_x_bridge', 'acc_rms_y_heel',
                     'acc_skew_y_bridge']

    X = step_features[best_features]

    # Load Trained Classifier
    with open("ITW_classifier.pkl", "rb") as f:
        ITW_classifier = pickle.load(f)

    # ITW classification
    y = ITW_classifier.predict(X)
    itw_steps = len(np.extract(y == 1, y))
    normal_steps = len(np.extract(y == 0, y))
    total_steps = len(y)
    ITW_res = pd.DataFrame([itw_steps,normal_steps,total_steps],columns=['itw_steps','normal_steps','total_steps'])

    # website data
    try:
        mean_kalman, emg_time = website_figure_1(kalman_signal,max_act_loc)
        avg_angle = pd.DataFrame(mean_kalman, columns=['time (s)','angle (deg)'])
        max_activation = pd.Series(emg_time)
        avg_angle.to_csv(f"../Website/CSV_Files/average_gait_angle.csv")
        max_activation.to_csv(f"../Website/CSV_Files/muscle_activation_time.csv")
        ITW_res.to_csv(f"../Website/CSV_Files/classification_result.csv")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def watch_directory_thread():
    processed_files = set()  # Keep track of already uploaded files
    path = '/home/smartstride/Website/bela_GUI_test'
    file_path = None
    
    try:
        for filename in os.listdir(path):
            if filename.endswith('.csv') and filename not in processed_files:
                file_path = os.path.join(path, filename)
                processed_files.add(filename)
                break  # Process only the first CSV file found
    except Exception as e:
        print(f"❌ Error watching directory: {str(e)}")
    
    if file_path is None:
        print("No CSV files found in the directory")
        # Return a default file or raise an exception
        return None
    
    return file_path

def main():
    imu_f = watch_directory_thread()
    if imu_f:
        itw_classification(imu_f, 40)
    else:
        print("No IMU file found. Exiting.")

if __name__ == "__main__":
    main()
