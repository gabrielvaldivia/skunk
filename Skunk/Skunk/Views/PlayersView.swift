import Foundation
import PhotosUI
import SwiftData
import SwiftUI

typealias Context = UIViewControllerRepresentableContext<ImagePicker>

struct PlayerFormView: View {
    @Binding var name: String
    @Binding var selectedImage: UIImage?
    @Binding var color: Color
    @State private var isImagePickerPresented = false
    @FocusState private var isNameFocused: Bool
    let existingPhotoData: Data?
    let existingColorData: Data?
    let title: String

    var body: some View {
        Form {
            Section {
                Button(action: { isImagePickerPresented.toggle() }) {
                    if let image = selectedImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 120, height: 120)
                            .clipShape(Circle())
                    } else if let photoData = existingPhotoData,
                        let uiImage = UIImage(data: photoData)
                    {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 120, height: 120)
                            .clipShape(Circle())
                    } else if name.isEmpty {
                        Circle()
                            .fill(Color(.tertiarySystemFill))
                            .frame(width: 120, height: 120)
                            .overlay {
                                Image(systemName: "plus")
                                    .font(.system(size: 40))
                                    .foregroundStyle(.primary)
                            }
                    } else {
                        let colorData = try? NSKeyedArchiver.archivedData(
                            withRootObject: UIColor(color),
                            requiringSecureCoding: true)
                        PlayerInitialsView(
                            name: name,
                            size: 120,
                            colorData: colorData)
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }

            Section {
                TextField("Name", text: $name)
                    .focused($isNameFocused)
                ColorPicker("Color", selection: $color)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isImagePickerPresented) {
            ImagePicker(image: $selectedImage)
        }
        .onAppear {
            isNameFocused = true
        }
    }
}

struct PlayersView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var players: [Player]

    @State private var showingAddPlayer = false
    @State private var newPlayerName = ""
    @State private var selectedImage: UIImage?
    @State private var newPlayerColor = Color.blue

    var body: some View {
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
                                name: player.name ?? "",
                                size: 40,
                                colorData: player.colorData)
                        }

                        Text(player.name ?? "")
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
                PlayerFormView(
                    name: $newPlayerName,
                    selectedImage: $selectedImage,
                    color: $newPlayerColor,
                    existingPhotoData: nil,
                    existingColorData: nil,
                    title: "New Player"
                )
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
        }
    }

    private func addPlayer() {
        let imageData = selectedImage?.jpegData(compressionQuality: 0.8)
        let player = Player(name: newPlayerName, photoData: imageData)
        if let colorData = try? NSKeyedArchiver.archivedData(
            withRootObject: UIColor(newPlayerColor),
            requiringSecureCoding: true
        ) {
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

    func updateUIViewController(
        _ uiViewController: UIImagePickerController, context: Context
    ) {}

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
