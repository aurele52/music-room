using Windows.Devices.Bluetooth.Advertisement;
using Windows.Storage.Streams;

if (args.Length != 1 ||
    !Guid.TryParse(args[0], out Guid eventId))
{
    Console.WriteLine("Usage: dotnet run -- <event-uuid>");
    return 1;
}

// MR1 + UUID in canonical byte order.
byte[] payload = Convert.FromHexString(
    "4D5231" + eventId.ToString("N")
);

var publisher = new BluetoothLEAdvertisementPublisher();
var manufacturer = new BluetoothLEManufacturerData();

using var writer = new DataWriter();

writer.WriteBytes(payload);

// Reserved identifier used for our prototype.
manufacturer.CompanyId = 0xFFFF;
manufacturer.Data = writer.DetachBuffer();

publisher.Advertisement.ManufacturerData.Add(manufacturer);

publisher.StatusChanged += (_, e) =>
{
    Console.WriteLine($"Status: {e.Status} | Error: {e.Error}");
};

Console.WriteLine("===== MUSIC ROOM BEACON =====");
Console.WriteLine($"Event   : {eventId}");
Console.WriteLine($"Payload : {Convert.ToHexString(payload)}");
Console.WriteLine($"Bytes   : {payload.Length}");

try
{
    publisher.Start();
    Thread.Sleep(2000);

    if (publisher.Status !=
        BluetoothLEAdvertisementPublisherStatus.Started)
    {
        Console.WriteLine($"Failure: {publisher.Status}");
        return 1;
    }

    Console.WriteLine("Beacon started. Press Enter to stop.");
    Console.ReadLine();
}
finally
{
    publisher.Stop();
}

return 0;
