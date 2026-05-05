export function initializeQueueSocket(io) {
  io.on("connection", (socket) => {
    socket.on("joinDoctorRoom", (doctorId) => {
      if (!doctorId) {
        return;
      }

      socket.join(`doctor:${doctorId}`);
    });

    socket.on("leaveDoctorRoom", (doctorId) => {
      if (!doctorId) {
        return;
      }

      socket.leave(`doctor:${doctorId}`);
    });
  });
}
