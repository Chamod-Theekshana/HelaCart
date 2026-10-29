import '../../../app/hc.dart';
import '../../checkout/presentation/checkout_screen.dart';

const districts = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: 'Delivery addresses',
    child: Protected(
      child: ref
          .watch(addressesProvider)
          .when(
            skipLoadingOnRefresh: false,
            skipLoadingOnReload: false,
            loading: () => const LoadingBlocks(),
            error: (e, _) =>
                ErrorState(e, retry: () => ref.invalidate(addressesProvider)),
            data: (rows) => ListView(
              padding: const EdgeInsets.all(20),
              children: [
                FilledButton.icon(
                  onPressed: () async {
                    await context.push('/account/addresses/new');
                    ref.invalidate(addressesProvider);
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add address'),
                ),
                verticalGap(20),
                if (rows.isEmpty)
                  const EmptyState(
                    title: 'No saved addresses',
                    message:
                        'Add an address to see destination delivery rates.',
                    icon: Icons.location_on_outlined,
                  ),
                for (final row in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            row.recipient,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(row.phone),
                          Text(row.formatted),
                          verticalGap(),
                          ActionButton(
                            label: 'Remove address',
                            outlined: true,
                            action: () async {
                              if (!await confirm(
                                context,
                                title: 'Remove address?',
                                message: 'Previous orders keep their original delivery address.',
                                action: 'Remove',
                              )) {
                                return;
                              }
                              await ref
                                  .read(repositoryProvider)
                                  .write('/me/addresses/${row.id}', 'DELETE');
                              ref.invalidate(addressesProvider);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
    ),
  );
}

class AddAddressScreen extends ConsumerStatefulWidget {
  const AddAddressScreen({super.key});
  @override
  ConsumerState<AddAddressScreen> createState() => _AddAddressScreenState();
}

class _AddAddressScreenState extends ConsumerState<AddAddressScreen> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final k in [
      'recipient',
      'phone',
      'line1',
      'line2',
      'city',
      'postalCode',
    ])
      k: TextEditingController(),
  };
  String? district;
  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> selectDistrict() async {
    String q = '';
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, update) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(c).height * .8,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                0,
                20,
                MediaQuery.viewInsetsOf(c).bottom,
              ),
              child: Column(
                children: [
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Search Sri Lankan districts',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (v) => update(() => q = v.toLowerCase()),
                  ),
                  verticalGap(),
                  Expanded(
                    child: ListView(
                      children: districts
                          .where((d) => d.toLowerCase().contains(q))
                          .map(
                            (d) => ListTile(
                              title: Text(d),
                              trailing: district == d
                                  ? const Icon(
                                      Icons.check,
                                      color: HelaColors.teal,
                                    )
                                  : null,
                              onTap: () => Navigator.pop(c, d),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (result != null && mounted) setState(() => district = result);
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Add delivery address',
    child: Protected(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final pair in [
                  ('recipient', 'Recipient full name'),
                  ('phone', 'Contact phone'),
                  ('line1', 'Address line 1'),
                  ('line2', 'Address line 2 (optional)'),
                  ('city', 'City'),
                  ('postalCode', 'Postal code'),
                ]) ...[
                  TextFormField(
                    controller: fields[pair.$1],
                    keyboardType: pair.$1 == 'phone'
                        ? TextInputType.phone
                        : pair.$1 == 'postalCode'
                        ? TextInputType.text
                        : TextInputType.streetAddress,
                    decoration: InputDecoration(labelText: pair.$2),
                    validator: (v) {
                      if (pair.$1 == 'line2') {
                        return v != null && v.length > 200
                            ? 'Use 200 characters or fewer.'
                            : null;
                      }
                      if (pair.$1 == 'phone') {
                        return v != null &&
                                RegExp(r'^\+?[0-9 ()-]{9,20}$')
                                    .hasMatch(v.trim())
                            ? null
                            : 'Enter a valid contact number.';
                      }
                      return requiredText(
                        v,
                        min: pair.$1 == 'line1'
                            ? 5
                            : pair.$1 == 'postalCode'
                            ? 3
                            : 2,
                        max: pair.$1 == 'recipient'
                            ? 100
                            : pair.$1 == 'city'
                            ? 80
                            : pair.$1 == 'postalCode'
                            ? 20
                            : 200,
                      );
                    },
                  ),
                  verticalGap(),
                ],
                OutlinedButton.icon(
                  onPressed: selectDistrict,
                  icon: const Icon(Icons.location_on_outlined),
                  label: Text(district ?? 'Choose district'),
                ),
                verticalGap(24),
                ActionButton(
                  label: 'Save address',
                  action: () async {
                    if (!form.currentState!.validate()) return;
                    if (district == null) {
                      throw const AppFailure('Choose a Sri Lankan district.');
                    }
                    final body = <String, dynamic>{
                      for (final e in fields.entries)
                        if (e.key != 'line2' || e.value.text.trim().isNotEmpty)
                          e.key: e.value.text.trim(),
                      'district': district,
                    };
                    final result = object(
                      await ref
                          .read(repositoryProvider)
                          .write('/me/addresses', 'POST', body),
                    );
                    ref.invalidate(addressesProvider);
                    if (context.mounted) context.pop(string(result['id']));
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
