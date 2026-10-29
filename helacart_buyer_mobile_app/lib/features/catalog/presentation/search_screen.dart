import 'dart:async';

import '../../../app/hc.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final input = TextEditingController();
  Timer? timer;
  String query = '';
  @override
  void dispose() {
    timer?.cancel();
    input.dispose();
    super.dispose();
  }

  void results() {
    final q = input.text.trim();
    if (q.isNotEmpty) {
      context.push('/products?q=${Uri.encodeQueryComponent(q)}&sort=relevance');
    }
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: 'Find a good find',
    child: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        TextField(
          controller: input,
          autofocus: true,
          maxLength: 80,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            counterText: '',
            hintText: 'Products, brands or shops',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(
              tooltip: 'Clear search',
              onPressed: () {
                input.clear();
                setState(() => query = '');
              },
              icon: const Icon(Icons.close),
            ),
          ),
          onSubmitted: (_) => results(),
          onChanged: (v) {
            timer?.cancel();
            timer = Timer(const Duration(milliseconds: 250), () {
              if (mounted) setState(() => query = v.trim());
            });
          },
        ),
        if (query.length < 2)
          const EmptyState(
            title: 'What are you looking for?',
            message: 'Search products, brands, categories and local shops.',
            icon: Icons.search,
          )
        else ...[
          TextButton(
            onPressed: results,
            child: Text('See all results for “$query”'),
          ),
          RemoteView(
            path: '/discovery/suggestions?q=${Uri.encodeQueryComponent(query)}',
            builder: (context, data) => Column(
              children: [
                for (final row in objects(data['products']))
                  ListTile(
                    leading: const Icon(Icons.search, size: 20),
                    title: Text(string(row['title'])),
                    subtitle: Text(string(object(row['seller'])['name'])),
                    onTap: () => context.push('/products/${row['id']}'),
                  ),
                for (final row in objects(data['categories']))
                  ListTile(
                    leading: const Icon(Icons.category_outlined),
                    title: Text(string(row['name'])),
                    onTap: () => context.push(
                      '/products?category=${Uri.encodeQueryComponent(string(row['slug']))}',
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}
