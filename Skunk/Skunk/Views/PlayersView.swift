import SwiftData
import SwiftUI
import UIKit

struct PlayersView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var players: [Player]

    @State private var showingAddPlayer = false
    @State private var newPlayerName = ""
    @State private var isImagePickerPresented = false
    @State private var selectedImage: UIImage?
    @State private var newPlayerColor = Color.blue

    var body: some View {
        NavigationStack {
            List {
                ForEach(players) { player in
                    NavigationLink(destination: PlayerDetailView(player: player)) {
                        HStack {
                            if let photoData = player.photoData,
                                let uiImage = UIImage(data: photoData)
                            {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 40, height: 40)
                                    .clipShape(Circle())
                            } else {
                                PlayerInitialsView(
                                    name: player.name,
                                    size: 40,
                                    colorData: player.colorData)
                            }

                            Text(player.name)
                                .padding(.leading, 8)
                        }
                    }
                }
                .onDelete(perform: deletePlayers)
            }
            .navigationTitle("Players")
            .toolbar {
                Button(action: {
                    newPlayerColor = Color(
                        hue: Double.random(in: 0...1), saturation: 0.7, brightness: 0.9)
                    showingAddPlayer.toggle()
                }) {
                    Label("Add Player", systemImage: "plus")
                }
            }
            .sheet(isPresented: $showingAddPlayer) {
                NavigationStack {
                    VStack(spacing: 20) {
                        Button(action: { isImagePickerPresented.toggle() }) {
                            if let image = selectedImage {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 120, height: 120)
                                    .clipShape(Circle())
                            } else if newPlayerName.isEmpty {
                                Circle()
                                    .fill(Color(.tertiarySystemFill))
                                    .frame(width: 120, height: 120)
                                    .overlay {
                                        Image(systemName: "plus")
                                            .font(.system(size: 40))
                                            .foregroundStyle(.secondary)
                                    }
                            } else {
                                let colorData = try? NSKeyedArchiver.archivedData(
                                    withRootObject: UIColor(newPlayerColor),
                                    requiringSecureCoding: true)
                                PlayerInitialsView(
                                    name: newPlayerName,
                                    size: 120,
                                    colorData: colorData)
                            }
                        }
                        .padding(.top, 40)

                        TextField("Player Name", text: $newPlayerName)
                            .textFieldStyle(.roundedBorder)
                            .padding(.horizontal)
                            .multilineTextAlignment(.center)

                        ColorPicker("Player Color", selection: $newPlayerColor)
                            .padding(.horizontal)

                        Spacer()
                    }
                    .navigationTitle("New Player")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") {
                                newPlayerName = ""
                                selectedImage = nil
                                showingAddPlayer = false
                            }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Add") {
                                addPlayer()
                            }
                            .disabled(newPlayerName.isEmpty)
                        }
                    }
                }
                .sheet(isPresented: $isImagePickerPresented) {
                    ImagePicker(image: $selectedImage)
                }
            }
        }
    }

    private func addPlayer() {
        let imageData = selectedImage?.jpegData(compressionQuality: 0.8)
        let player = Player(name: newPlayerName, photoData: imageData)
        if let colorData = try? NSKeyedArchiver.archivedData(
            withRootObject: UIColor(newPlayerColor), requiringSecureCoding: true)
        {
            player.colorData = colorData
        }
        modelContext.insert(player)
        newPlayerName = ""
        selectedImage = nil
        showingAddPlayer = false
    }

    private func deletePlayers(offsets: IndexSet) {
        withAnimation {
            for index in offsets {
                modelContext.delete(players[index])
            }
        }
    }
}

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }
    }
}

#Preview {
    PlayersView()
        .modelContainer(for: Player.self, inMemory: true)
}
