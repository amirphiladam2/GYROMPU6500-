#!/usr/bin/env python3
"""
Serial to WebSocket Bridge for Gyroscope Dashboard
Connects Arduino serial data to web dashboard via WebSocket
"""

import asyncio
import websockets
import serial
import json
import threading
import time
from serial.tools import list_ports

class SerialWebSocketBridge:
    def __init__(self):
        self.serial_connection = None
        self.websocket_clients = set()
        self.is_running = False
        self.loop = None
        
    def list_serial_ports(self):
        """List available serial ports"""
        ports = list_ports.comports()
        return [{"port": port.device, "description": port.description} for port in ports]
    
    def connect_serial(self, port, baudrate=9600):
        """Connect to serial port"""
        try:
            if self.serial_connection and self.serial_connection.is_open:
                self.serial_connection.close()
            
            self.serial_connection = serial.Serial(
                port=port,
                baudrate=baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=1
            )
            print(f"Connected to {port} at {baudrate} baud")
            return True
        except Exception as e:
            print(f"Failed to connect to {port}: {e}")
            return False
    
    def disconnect_serial(self):
        """Disconnect from serial port"""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
            print("Serial connection closed")
    
    def read_serial_data(self):
        """Read data from serial port and broadcast to WebSocket clients"""
        buffer = ""
        while self.is_running and self.serial_connection and self.serial_connection.is_open:
            try:
                if self.serial_connection.in_waiting > 0:
                    data = self.serial_connection.readline().decode('utf-8', errors='ignore').strip()
                    if data:
                        try:
                            # Try to parse as JSON
                            json_data = json.loads(data)
                            # Broadcast to all connected clients
                            if self.websocket_clients and self.loop:
                                asyncio.run_coroutine_threadsafe(
                                    self.broadcast_data(json.dumps(json_data)), self.loop
                                )
                        except json.JSONDecodeError:
                            # If not JSON, wrap in a message object
                            message = {"type": "raw", "data": data}
                            if self.websocket_clients and self.loop:
                                asyncio.run_coroutine_threadsafe(
                                    self.broadcast_data(json.dumps(message)), self.loop
                                )
                time.sleep(0.01)  # Small delay to prevent CPU overload
            except Exception as e:
                print(f"Serial read error: {e}")
                break
    
    async def broadcast_data(self, data):
        """Broadcast data to all connected WebSocket clients"""
        if self.websocket_clients:
            # Create a copy of the set to avoid modification during iteration
            clients_copy = self.websocket_clients.copy()
            for client in clients_copy:
                try:
                    await client.send(data)
                except websockets.exceptions.ConnectionClosed:
                    self.websocket_clients.discard(client)
                except Exception as e:
                    print(f"Error sending to client: {e}")
                    self.websocket_clients.discard(client)
    
    async def handle_websocket(self, websocket, path):
        """Handle WebSocket connections"""
        print(f"New WebSocket connection: {websocket.remote_address}")
        self.websocket_clients.add(websocket)
        
        try:
            async for message in websocket:
                try:
                    command = json.loads(message)
                    await self.handle_command(websocket, command)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"error": "Invalid JSON"}))
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.websocket_clients.discard(websocket)
            print(f"WebSocket connection closed: {websocket.remote_address}")
    
    async def handle_command(self, websocket, command):
        """Handle commands from WebSocket clients"""
        cmd_type = command.get("type")
        
        if cmd_type == "list_ports":
            ports = self.list_serial_ports()
            await websocket.send(json.dumps({"type": "ports", "data": ports}))
        
        elif cmd_type == "connect":
            port = command.get("port")
            baudrate = command.get("baudrate", 115200)
            success = self.connect_serial(port, baudrate)
            
            if success:
                # Start serial reading thread
                self.is_running = True
                self.serial_thread = threading.Thread(target=self.read_serial_data)
                self.serial_thread.daemon = True
                self.serial_thread.start()
                
                await websocket.send(json.dumps({"type": "connected", "port": port, "baudrate": baudrate}))
            else:
                await websocket.send(json.dumps({"type": "error", "message": f"Failed to connect to {port}"}))
        
        elif cmd_type == "disconnect":
            self.is_running = False
            self.disconnect_serial()
            await websocket.send(json.dumps({"type": "disconnected"}))
    
    async def start_server(self, host="localhost", port=8765):
        """Start the WebSocket server"""
        self.loop = asyncio.get_running_loop()
        print(f"Starting WebSocket server on ws://{host}:{port}")
        return await websockets.serve(self.handle_websocket, host, port)

def main():
    bridge = SerialWebSocketBridge()

    async def run_server():
        server = await bridge.start_server()
        print("Serial-WebSocket bridge started!")
        print("Connect your web dashboard to: ws://localhost:8765")
        print("Press Ctrl+C to stop")
        await asyncio.Future()  # Run forever

    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\nShutting down...")
        bridge.is_running = False
        bridge.disconnect_serial()

if __name__ == "__main__":
    main()
